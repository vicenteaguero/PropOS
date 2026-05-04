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

from app.features.anita.intent_registry import _is_falsy
from app.features.anita.intent_registry import get as get_intent_spec
from app.features.anita.intent_registry import missing_required
from app.features.anita.resolver import ResolvedFields
from app.features.anita.tools.executors import _create_proposal


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
        whitelist |= {"summary", "summary_es"}  # always allowed
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

    elif intent == "create_task":
        title = payload.pop("task_title", None) or payload.pop("title", None) or extras.get("summary") or "tarea"
        payload["title"] = title
        payload.setdefault("kind", "TODO")
        payload.setdefault("summary_es", title)

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

    elif intent == "create_property":
        if "title" not in payload and resolved.property:
            payload["title"] = resolved.property.raw
        payload.setdefault("status", "AVAILABLE")
        payload.setdefault("summary_es", f"crear propiedad {payload.get('title', '?')}")

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
) -> dict[str, Any]:
    """Run one intent. Returns a uniform shape consumed by ``chat.run_chat_turn``::

      {kind, ...} where kind ∈ {"proposal", "query", "clarify", "out_of_scope"}.
    """
    if intent == "out_of_scope":
        return {"kind": "out_of_scope", "message": "No identifiqué una acción clara. ¿Podés repetirlo?"}

    if intent == "ambiguous":
        return {
            "kind": "clarify",
            "reason": resolved.extras.get("reason", "")
                      or "el clasificador marcó ambigüedad",
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

    result = _create_proposal(
        kind=proposal_kind,
        payload=payload,
        target_table=target_table,
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )
    # `_create_proposal` returns its own `kind` (e.g. "propose_log_interaction").
    # Overwrite outcome.kind with the high-level shape so chat.py can branch.
    return {**result, "kind": "proposal", "proposal_kind": result.get("kind")}


def _dispatch_query(intent: str, resolved: ResolvedFields, tenant_id: UUID) -> dict[str, Any]:
    """Run analytics tools without involving the LLM."""
    from app.features.anita.tools.query_data import run_query

    if intent == "query_count":
        view = resolved.extras.get("view")
        if not view:
            return {"kind": "clarify", "reason": "falta `view` para query_count"}
        result = run_query({"view": view, "filters": {}}, tenant_id)
        return {"kind": "query", "tool": "query_views", "result": result}

    # query_freeform: classifier doesn't write SQL — escalate to a small
    # follow-up LLM call (handled by chat.py orchestrator) or punt for now.
    return {
        "kind": "needs_sql",
        "intent_text": resolved.extras.get("intent_text") or resolved.extras.get("summary") or "",
    }
