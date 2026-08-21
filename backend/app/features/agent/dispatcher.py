"""Deterministic dispatch of intents → domain ops.

Takes the classifier intent + resolver output and either:
- writes to ``pending_proposals`` via the existing
  ``executors._create_proposal`` helper
- runs an analytics query (views or text-to-SQL)
- returns a ``clarify`` event when ambiguity blocks progress
- returns ``out_of_scope`` when nothing actionable was inferred

Zero LLM calls. The classifier's job ends before this point.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.features.agent.attribution import agent_attribution
from app.features.agent.intent_registry import _is_falsy
from app.features.agent.intent_registry import get as get_intent_spec
from app.features.agent.intent_registry import missing_required
from app.features.agent.resolver import ResolvedFields
from app.features.agent.policies import AutonomyLevel, level_for
from app.features.agent.tools.executors import ACCEPTOR_BY_KIND, _create_proposal

logger = get_logger("AGENT_DISPATCH")


def _build_payload(intent: str, resolved: ResolvedFields) -> dict[str, Any]:
    """Translate classifier extras + resolved IDs into a proposal payload.

    Generic body driven by the registry: every required/optional/detailed
    field declared for the intent flows through verbatim. The per-intent
    branches below add resolved entity IDs and intent-specific fallbacks.
    """
    extras = dict(resolved.extras)
    payload: dict[str, Any] = {}

    spec = get_intent_spec(intent)
    if spec is not None:
        whitelist = set(spec.required) | set(spec.optional) | {n for n, _ in spec.detailed}
        whitelist |= {"summary", "summary_es"}
        for k in list(extras):
            if k in whitelist and not _is_falsy(extras[k]):
                payload[k] = extras.pop(k)

    # Lower-case the keys we expect downstream (model sometimes capitalizes).
    payload = {k.lower() if k[:1].isupper() else k: v for k, v in payload.items()}

    if "summary_es" not in payload and "summary" in payload:
        payload["summary_es"] = payload["summary"]

    # Per-intent fallbacks + resolved IDs.
    if intent == "log_interaction":
        if resolved.person and resolved.person.resolved_id:
            payload["participant_person_ids"] = [str(resolved.person.resolved_id)]
        if resolved.property and resolved.property.resolved_id:
            payload["property_id"] = str(resolved.property.resolved_id)
        if resolved.project and resolved.project.resolved_id:
            payload["project_id"] = str(resolved.project.resolved_id)
        payload.setdefault("kind", "NOTE")
        payload.setdefault("summary", "interacción registrada")
        payload.setdefault("summary_es", payload["summary"])

    elif intent == "create_person":
        if "full_name" not in payload:
            payload["full_name"] = resolved.person.raw if resolved.person else ""
        payload.setdefault("kind", "OTHER")
        payload.setdefault("summary_es", f"crear contacto {payload.get('full_name', '?')}")

    elif intent == "update_person":
        if resolved.person and resolved.person.resolved_id:
            payload["id"] = str(resolved.person.resolved_id)
        payload.setdefault("summary_es", f"actualizar {payload.get('full_name', 'contacto')}")

    elif intent == "create_task":
        title = payload.pop("task_title", None) or payload.pop("title", None) or extras.get("summary") or "tarea"
        payload["title"] = title
        payload.setdefault("kind", "TODO")
        payload.setdefault("summary_es", title)
        # Wire resolved entities into the task's polymorphic `related` JSONB so a
        # task created for "la propiedad de Apoquindo" stays linked to it.
        related: dict[str, list[str]] = {}
        if resolved.property and resolved.property.resolved_id:
            related["properties"] = [str(resolved.property.resolved_id)]
        if resolved.person and resolved.person.resolved_id:
            # "contacts", matching the table and every other reader. This wrote
            # "people" while `contacts/overview.py` counted "contacts", so a
            # task Propo created never showed on the person it was about.
            related["contacts"] = [str(resolved.person.resolved_id)]
        if resolved.project and resolved.project.resolved_id:
            related["projects"] = [str(resolved.project.resolved_id)]
        if related:
            payload["related"] = related

    elif intent == "create_event":
        payload.setdefault("title", extras.get("summary") or "evento")
        payload.setdefault("kind", "VISIT")
        if resolved.person and resolved.person.resolved_id:
            payload["contact_id"] = str(resolved.person.resolved_id)
        if resolved.property and resolved.property.resolved_id:
            payload["property_id"] = str(resolved.property.resolved_id)
        if resolved.project and resolved.project.resolved_id:
            payload["project_id"] = str(resolved.project.resolved_id)
        payload.setdefault("summary_es", f"agendar {payload.get('title', 'evento')}")

    elif intent == "log_transaction":
        payload.setdefault("currency", "CLP")
        payload.setdefault("summary_es", f"transacción {payload.get('direction', '?')} {payload.get('amount', '?')}")
        if resolved.project and resolved.project.resolved_id:
            payload["related_project_id"] = str(resolved.project.resolved_id)
        if resolved.property and resolved.property.resolved_id:
            payload["related_property_id"] = str(resolved.property.resolved_id)

    elif intent == "create_organization":
        payload.setdefault("name", payload.pop("name", "") or (resolved.org.raw if resolved.org else ""))
        payload.setdefault("kind", "OTHER")
        payload.setdefault("summary_es", f"crear organización {payload.get('name', '?')}")

    elif intent == "add_note":
        payload.setdefault("body", payload.pop("body", None) or extras.get("summary") or "nota")
        payload.setdefault("summary_es", payload["body"][:80])
        # Attach the note to the single resolved entity (property > person >
        # project), matching `notes.target_table`/`target_row_id`.
        if resolved.property and resolved.property.resolved_id:
            payload["target_table"] = "properties"
            payload["target_row_id"] = str(resolved.property.resolved_id)
        elif resolved.person and resolved.person.resolved_id:
            payload["target_table"] = "contacts"
            payload["target_row_id"] = str(resolved.person.resolved_id)
        elif resolved.project and resolved.project.resolved_id:
            payload["target_table"] = "projects"
            payload["target_row_id"] = str(resolved.project.resolved_id)

    elif intent == "create_property":
        if "title" not in payload and resolved.property:
            payload["title"] = resolved.property.raw
        payload.setdefault("status", "AVAILABLE")
        payload.setdefault("summary_es", f"crear propiedad {payload.get('title', '?')}")

    elif intent == "attach_photos_to_property":
        if resolved.property and resolved.property.resolved_id:
            payload["property_id"] = str(resolved.property.resolved_id)
        if "title" not in payload and resolved.property:
            payload["title"] = resolved.property.raw
        payload.setdefault("summary_es", f"adjuntar fotos a {payload.get('title', '?')}")

    elif intent == "create_document_from_photos":
        if "title" not in payload:
            payload["title"] = extras.get("summary") or "documento sin título"
        payload.setdefault("summary_es", f"crear documento {payload['title']} con fotos")

    elif intent == "create_campaign":
        payload.setdefault("currency", "CLP")
        payload.setdefault("summary_es", f"crear campaña {payload.get('name', '?')}")

    return payload


def dispatch(
    intent: str,
    resolved: ResolvedFields,
    *,
    tenant_id: UUID,
    user_id: UUID,
    session_id: UUID,
    evidence: dict[str, Any] | None = None,
    message_id: str | None = None,
    force_level: AutonomyLevel | None = None,
) -> dict[str, Any]:
    """Run one intent. Returns a uniform shape consumed by ``chat.run_chat_turn``::

    {kind, ...} where kind ∈ {"proposal", "query", "clarify", "out_of_scope"}.
    """
    if intent == "out_of_scope":
        return {"kind": "out_of_scope", "message": "No identifiqué una acción clara. ¿Puedes repetirlo?"}

    if intent == "ambiguous":
        return {
            "kind": "clarify",
            "reason": resolved.extras.get("reason", "") or "el clasificador marcó ambigüedad",
            "candidates": resolved.ambiguity_summary,
        }

    if intent in ("query_count", "query_freeform"):
        return _dispatch_query(intent, resolved, tenant_id)

    if resolved.is_ambiguous:
        return {
            "kind": "clarify",
            "reason": "Hay más de un candidato; necesito que confirmes cuál.",
            "candidates": resolved.ambiguity_summary,
        }

    intent_spec = get_intent_spec(intent)
    if intent_spec is None:
        return {"kind": "out_of_scope", "message": f"intent desconocido: {intent}"}

    proposal_kind = intent_spec.proposal_kind
    target_table = intent_spec.target_table
    payload = _build_payload(intent, resolved)

    # Media-consuming intents: pull recent unprocessed photos for this session
    # and stage them on the payload. Executor decides what to do with them.
    if intent_spec.consumes_media:
        media_msgs = _consume_media_buffer(session_id)
        if not media_msgs:
            return {
                "kind": "clarify",
                "reason": "No tengo fotos recientes en esta conversación. Mándamelas y vuelve a pedírmelo.",
                "candidates": [],
            }
        payload["media_message_ids"] = [m["id"] for m in media_msgs]

    # update_person needs an existing match to update. No id → ask the user.
    if intent == "update_person" and not payload.get("id"):
        return {
            "kind": "clarify",
            "reason": "No encontré a esa persona. ¿Puedes confirmar el nombre exacto?",
            "candidates": [],
        }

    # Required-field guard: if any required key is still missing after the
    # 2-pass + defaults, ask the user instead of writing a broken proposal.
    missing = missing_required(intent, payload)
    if missing:
        return {
            "kind": "clarify",
            "reason": f"Para {intent} faltan: {', '.join(missing)}.",
            "candidates": [],
            "missing_fields": missing,
        }

    # How much of this Propo may do alone is the tenant's call, not a constant
    # in this file. `observe` records the intent and stops; `execute` writes the
    # domain row; `suggest` — the default for anything touching a person, a
    # deal, money or the outside world — queues a proposal for a human.
    # `force_level` exists for one caller: extraction from an INBOUND CLIENT
    # message. The tenant's policy governs what the broker's own instructions
    # may do unattended; a message from outside the company is not an
    # instruction, and "agenda una visita mañana" from a stranger must not
    # become a calendar entry because a model found an intent in it.
    level = force_level or level_for(tenant_id, intent)

    if level is AutonomyLevel.OBSERVE:
        logger.info("agent_observe_only", event_type="policy", intent=intent)
        return {
            "kind": "observed",
            "proposal_kind": proposal_kind,
            "target_table": target_table,
            "summary_es": payload.get("summary_es"),
            "payload": payload,
        }

    if level is AutonomyLevel.EXECUTE:
        accept_fn = ACCEPTOR_BY_KIND.get(proposal_kind)
        if accept_fn is not None:
            try:
                # Same audit attribution the manual accept path stamps, so the
                # trigger records source='agent' + the session id.
                with agent_attribution(session_id):
                    committed_table, row_id = accept_fn(dict(payload), tenant_id, user_id, session_id)
            except Exception as exc:  # noqa: BLE001
                # The direct write failed (e.g. a DB constraint). Fall back to a
                # proposal so the user can fix it by hand rather than losing the
                # action outright.
                result = _create_proposal(
                    kind=proposal_kind,
                    payload=payload,
                    target_table=target_table,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    session_id=session_id,
                    evidence=evidence,
                    message_id=message_id,
                )
                return {
                    **result,
                    "kind": "proposal",
                    "proposal_kind": result.get("kind"),
                    "execute_error": str(exc)[:200],
                }
            return {
                "kind": "executed",
                "proposal_kind": proposal_kind,
                "target_table": committed_table,
                "row_id": str(row_id),
                "summary_es": payload.get("summary_es"),
                "payload": payload,
            }

    result = _create_proposal(
        kind=proposal_kind,
        payload=payload,
        target_table=target_table,
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        evidence=evidence,
        message_id=message_id,
    )
    # `_create_proposal` returns its own `kind` (e.g. "propose_log_interaction").
    # Overwrite outcome.kind with the high-level shape so chat.py can branch.
    return {**result, "kind": "proposal", "proposal_kind": result.get("kind")}


def _consume_media_buffer(session_id: UUID, *, max_age_min: int = 60) -> list[dict[str, Any]]:
    """Return the current "pack" of unprocessed media for the session.

    A pack = photos that arrived AFTER the last assistant turn (so previous
    packs that Agent already responded to don't leak into the next intent),
    within ``max_age_min`` (1h default). Same-session only — no cross-session
    bleed since the query is keyed to ``session_id``.
    """
    from datetime import UTC, datetime, timedelta

    from app.core.supabase.client import get_supabase_client

    db = get_supabase_client()
    cutoff = (datetime.now(UTC) - timedelta(minutes=max_age_min)).isoformat()

    last_assistant = (
        # tenant-safe: scoped by agent session, which is itself tenant-bound
        db.table("agent_messages")
        .select("created_at")
        .eq("session_id", str(session_id))
        .eq("role", "assistant")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    pack_floor = last_assistant[0]["created_at"] if last_assistant else cutoff
    floor = max(pack_floor, cutoff)

    rows = (
        # tenant-safe: scoped by agent session, which is itself tenant-bound
        db.table("agent_messages")
        .select("id, media_url, media_mime, media_kapso_id")
        .eq("session_id", str(session_id))
        .eq("media_status", "unprocessed")
        .gt("created_at", floor)
        .order("created_at")
        .execute()
        .data
    )
    return rows or []


def _dispatch_query(intent: str, resolved: ResolvedFields, tenant_id: UUID) -> dict[str, Any]:
    """Run analytics tools.

    `query_count` hits a precomputed view. `query_freeform` triggers a
    second LLM call (text-to-SQL) which is the only place outside the
    classifier where we touch a model.
    """
    from app.features.agent.tools.query_data import run_query

    if intent == "query_count":
        view = resolved.extras.get("view")
        if not view:
            return {"kind": "clarify", "reason": "falta `view` para query_count"}
        result = run_query({"view": view, "filters": {}}, tenant_id)
        return {"kind": "query", "tool": "query_views", "result": result}

    # query_freeform: synchronous text-to-SQL. The dispatcher is sync but
    # the SQL generator needs an LLM, so we run it on a fresh event loop
    # (chat.py invokes dispatch from inside an async generator already, so
    # using asyncio.run here would conflict — instead we call the sync
    # wrapper that drives the LLM via httpx).
    import asyncio

    from app.features.agent.tools.text_to_sql import generate_and_run_sql

    question = (
        resolved.extras.get("intent_text") or resolved.extras.get("summary") or resolved.extras.get("question") or ""
    )
    if not question:
        return {
            "kind": "needs_sql",
            "intent_text": "",
        }

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an async caller — run in a new loop in a thread.
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, generate_and_run_sql(question, tenant_id))
                result = future.result(timeout=30)
        else:
            result = asyncio.run(generate_and_run_sql(question, tenant_id))
    except Exception as exc:  # noqa: BLE001
        return {"kind": "error", "reason": f"text_to_sql_failed: {exc}"}

    if result.get("kind") == "query_sql":
        return {
            "kind": "query_sql",
            "sql": result["sql"],
            "columns": result["columns"],
            "rows": result["rows"],
            "row_count": result["row_count"],
        }
    if result.get("kind") == "out_of_scope":
        return {"kind": "out_of_scope", "message": result["message"]}
    return {"kind": "error", "reason": result.get("reason", "sql_failed"), "sql": result.get("sql")}
