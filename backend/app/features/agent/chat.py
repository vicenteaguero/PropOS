"""Agent conversation orchestrator (v2).

Pipeline: classify → resolve → dispatch.

- One LLM call (the classifier) per turn. Output is dense KV, not JSON.
- Resolution + dispatch are deterministic Python — no model calls.
- Optional second LLM call for ``query_freeform`` (text-to-SQL) only when
  ``query_views`` doesn't fit. Keeps the per-turn token cost ~600 tokens
  for the hot path.

Yields the same SSE event shapes as the old multi-turn loop so the
frontend doesn't change: ``text`` / ``tool_use`` / ``done``.
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.agent.classifier import classify, extract_details
from app.features.agent.context import invalidate_snapshot, load_snapshot
from app.features.agent.dispatcher import dispatch
from app.features.agent.intent_registry import get as get_intent_spec
from app.features.agent.intent_registry import needs_pass_two, normalize_fields, real_captures
from app.features.agent.llm_retry import LLMUnavailableError
from app.features.agent.rate_limiter import QuotaExhaustedError
from app.features.agent.postprocess import dedupe_actions, expand_money_units, normalize_rut
from app.features.agent.pricing import cost_cents_exact
from app.features.agent.resolver import resolve

logger = get_logger("AGENT_CHAT")


async def run_chat_turn(
    session_id: UUID,
    tenant_id: UUID,
    user_id: UUID,
    user_text: str,
) -> AsyncIterator[dict[str, Any]]:
    """Run one turn end-to-end, streaming events for the frontend.

    Anything the turn raises is caught here and rendered as a Spanish `text`
    event followed by `done`. The frontend only understands text/tool_use/done,
    and an SSE stream that just stops looks like a frozen chat.
    """
    try:
        async for event in _stream_turn(session_id, tenant_id, user_id, user_text):
            yield event
    except QuotaExhaustedError as exc:
        logger.warning(
            "turn_quota_exhausted",
            event_type="rate_limit",
            session_id=str(session_id),
            window=exc.window,
            wait_seconds=int(exc.wait_seconds),
        )
        yield {
            "type": "text",
            "text": ("Se acabó la cuota de IA por ahora. Probá de nuevo más tarde o avisá al equipo. 🙏"),
        }
        yield {"type": "done", "proposals_created": [], "executed_rows": [], "error": "quota_exhausted"}
    except LLMUnavailableError as exc:
        logger.warning("turn_llm_unavailable", event_type="llm", session_id=str(session_id), error=str(exc)[:200])
        yield {
            "type": "text",
            "text": "El proveedor de IA no está respondiendo. Probá de nuevo en unos segundos. 🙏",
        }
        yield {"type": "done", "proposals_created": [], "executed_rows": [], "error": "llm_unavailable"}
    except Exception as exc:  # noqa: BLE001
        logger.error("turn_failed", event_type="error", session_id=str(session_id), error=str(exc)[:300])
        yield {
            "type": "text",
            "text": "Se me cayó algo procesando eso. Volvé a intentarlo y, si sigue, avisá al equipo. 🙏",
        }
        yield {"type": "done", "proposals_created": [], "executed_rows": [], "error": "turn_failed"}


async def _stream_turn(
    session_id: UUID,
    tenant_id: UUID,
    user_id: UUID,
    user_text: str,
) -> AsyncIterator[dict[str, Any]]:
    """The turn itself. Raises; `run_chat_turn` is the degradation boundary."""
    client = get_supabase_client()
    t0 = time.perf_counter()

    cap = settings.agent_turns_per_user_per_day
    if cap > 0:
        used = client.rpc("agent_user_turns_today", {"p_user_id": str(user_id)}).execute().data or 0
        if isinstance(used, list):
            used = used[0] if used else 0
        if int(used) >= cap:
            logger.info("turn_quota_exceeded", event_type="quota", user_id=str(user_id), cap=cap, used=int(used))
            yield {
                "type": "text",
                "text": (f"Llegaste al tope diario ({cap} turnos). Probá de nuevo mañana o bajá el ritmo. 🙏"),
            }
            yield {"type": "done"}
            return

    _save_message(client, tenant_id, session_id, "user", user_text)

    classification = await classify(user_text)

    # Cheap deterministic cleanups before resolve+dispatch.
    classification.actions = dedupe_actions(classification.actions, user_text=user_text)
    for a in classification.actions:
        normalize_rut(a)
        expand_money_units(a, user_text)

    logger.info(
        "classifier_done",
        event_type="llm",
        n_actions=len(classification.actions),
        intents=[a.intent for a in classification.actions],
        tokens_in=classification.tokens_in,
        tokens_out=classification.tokens_out,
    )

    snapshot = load_snapshot(tenant_id)
    proposals_created: list[str] = []
    executed_rows: list[dict[str, str]] = []
    response_chunks: list[str] = []
    blocks: list[dict[str, Any]] = []
    pass2_in = pass2_out = 0

    for action in classification.actions:
        # Pass 2: targeted detail extraction for complex intents only.
        spec = get_intent_spec(action.intent)
        if spec and spec.complex and needs_pass_two(action.intent, action.fields):
            new_fields, tin, tout = await extract_details(
                intent=action.intent,
                user_text=user_text,
                captured=real_captures(action.fields),
                detailed=list(spec.detailed),
            )
            pass2_in += tin
            pass2_out += tout
            # Pass-2 wins over pass-1 (it saw the field list explicitly).
            for k, v in new_fields.items():
                if v not in (None, "", 0):
                    action.fields[k] = v
            # Re-apply unit-expansion now that more numeric fields landed.
            expand_money_units(action, user_text)
            logger.info(
                "pass2_done",
                event_type="llm",
                intent=action.intent,
                added_keys=list(new_fields.keys()),
                tokens_in=tin,
                tokens_out=tout,
            )

        # Apply registry aliases + defaults BEFORE resolver/dispatcher.
        action.fields.update(normalize_fields(action.intent, action.fields))

        # query_freeform needs the raw user question — classifier may have
        # only emitted a short `summary=`. Stash the full text so the
        # text-to-SQL prompt has full context.
        if action.intent == "query_freeform":
            action.fields.setdefault("intent_text", user_text)

        resolved = resolve(action.fields, snapshot, intent=action.intent)
        outcome = dispatch(
            action.intent,
            resolved,
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
        )

        # Frontend SSE: one tool_use per action.
        yield {
            "type": "tool_use",
            "name": _tool_name_for(action.intent, outcome),
            "args": {
                **action.fields,
                **{k: str(v) for k, v in _entity_ids(resolved).items()},
            },
        }

        if outcome.get("kind") == "proposal" and (pid := outcome.get("proposal_id")):
            proposals_created.append(pid)
            blocks.append(
                {
                    "type": "tool_use",
                    "id": pid,
                    "name": outcome.get("proposal_kind", ""),
                    "input": action.fields,
                }
            )
        elif outcome.get("kind") == "executed":
            # The row we just wrote must be resolvable next turn, so drop the
            # cached snapshot the resolver reads from.
            invalidate_snapshot(tenant_id)
            executed_rows.append(
                {
                    "kind": outcome.get("proposal_kind", ""),
                    "table": outcome.get("target_table", ""),
                    "row_id": outcome.get("row_id", ""),
                }
            )
            blocks.append(
                {
                    "type": "tool_use",
                    "id": outcome.get("row_id", ""),
                    "name": outcome.get("proposal_kind", ""),
                    "input": action.fields,
                }
            )

        response_chunks.append(_format_response(action.intent, outcome, resolved))

    assistant_text = " ".join(response_chunks) or "Listo."
    yield {"type": "text", "text": assistant_text}

    # Persist assistant turn.
    blocks.insert(0, {"type": "text", "text": assistant_text})
    _save_message(
        client,
        tenant_id,
        session_id,
        "assistant",
        blocks,
        tokens_in=classification.tokens_in + pass2_in,
        tokens_out=classification.tokens_out + pass2_out,
    )

    from datetime import UTC, datetime

    client.table("agent_sessions").update({"last_activity_at": datetime.now(UTC).isoformat()}).eq(
        "id", str(session_id)
    ).eq("tenant_id", str(tenant_id)).execute()

    yield {
        "type": "done",
        "proposals_created": proposals_created,
        "executed_rows": executed_rows,
        "tokens": {
            "in": classification.tokens_in + pass2_in,
            "out": classification.tokens_out + pass2_out,
            "pass1_in": classification.tokens_in,
            "pass1_out": classification.tokens_out,
            "pass2_in": pass2_in,
            "pass2_out": pass2_out,
        },
        "intents": [a.intent for a in classification.actions],
        "latency_ms": int((time.perf_counter() - t0) * 1000),
    }


def _entity_ids(resolved) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name in ("person", "property", "project", "org"):
        fr = getattr(resolved, name, None)
        if fr and fr.resolved_id:
            out[f"{name}_id"] = fr.resolved_id
    return out


def _tool_name_for(intent: str, outcome: dict[str, Any]) -> str:
    kind = outcome.get("kind")
    if kind == "clarify":
        return "clarify"
    if kind == "query":
        return "query_views"
    if kind == "needs_sql" or kind == "query_sql":
        return "query_sql"
    if kind == "error":
        return "error"
    if kind == "out_of_scope":
        return "out_of_scope"
    return {
        "log_interaction": "propose_log_interaction",
        "create_person": "propose_create_person",
        "create_task": "propose_create_task",
        "log_transaction": "propose_log_transaction",
        "create_organization": "propose_create_organization",
        "add_note": "propose_add_note",
    }.get(intent, intent)


def _format_response(intent: str, outcome: dict[str, Any], resolved) -> str:
    """Plain templated response — no second LLM call. Good enough for a CRM
    confirmation. Tone matches the existing Spanish style."""
    kind = outcome.get("kind")
    if kind == "out_of_scope":
        return outcome.get("message", "No entendí, ¿podés repetirlo?")
    if kind == "clarify":
        reason = outcome.get("reason", "necesito más info")
        cands = outcome.get("candidates", [])
        if cands:
            names = ", ".join(
                c.get("label") or c.get("raw") or "?" for cand in cands for c in cand.get("candidates", [])
            )[:200]
            return f"Aclárame antes de seguir: {reason}. Candidatos: {names}."
        return f"Aclárame antes de seguir: {reason}."
    if kind == "query":
        result = outcome.get("result", {})
        summary = result.get("summary", {})
        if "total" in summary:
            return f"Tienes {summary['total']} en total."
        if "count" in summary:
            return f"Cuento {summary['count']}."
        return f"Resultado: {json.dumps(summary, ensure_ascii=False)[:200]}"
    if kind == "needs_sql":
        return "No alcancé a entender la pregunta. ¿Podés repetirla con más detalle?"
    if kind == "query_sql":
        rows = outcome.get("rows", [])
        n = outcome.get("row_count", len(rows))
        if n == 0:
            return "Consulté la base y no hay resultados."
        # Compact preview: up to 5 rows, first 4 columns.
        cols = outcome.get("columns", [])[:4]
        preview = []
        for r in rows[:5]:
            preview.append(", ".join(f"{c}={r.get(c)}" for c in cols))
        more = f" (+{n - 5} más)" if n > 5 else ""
        return f"Encontré {n}: " + " | ".join(preview) + more
    if kind == "error":
        reason = outcome.get("reason", "error")
        return f"Hubo un error al consultar: {reason[:160]}"
    if kind == "executed":
        summary_es = (outcome.get("summary_es") or "").strip()
        if summary_es:
            return f"Listo, {summary_es}."
        table = outcome.get("target_table", "")
        return f"Listo, agregado en {table}." if table else "Listo."
    if kind == "proposal":
        summary_es = (outcome.get("summary_es") or "").strip()
        if summary_es:
            return f"Listo, dejé pendiente: {summary_es}."
        return "Listo, dejé pendiente la propuesta para que la revises."
    return "Listo."


def _cost_cents_for_turn(
    client,
    session_id: UUID,
    tokens_in: int,
    tokens_out: int,
) -> int | None:
    """Integer cents to charge this row so the session total stays exact.

    `agent_messages.cost_cents` is an INT and one turn costs a fraction of a
    cent, so rounding each row independently writes 0 forever — the reason the
    cost dashboard reported $0. Instead we round the session's *running* total
    and store the delta: individual rows are 0 or 1, and the sum tracks the
    real cost to within one cent per session.

    Returns None when the model has no published price (honest NULL, not 0).
    """
    provider, model = settings.agent_provider, settings.agent_model
    if cost_cents_exact(provider, model, 1, 1) is None:
        return None

    prior = (
        client.table("agent_messages")
        .select("tokens_in,tokens_out,cost_cents")
        .eq("session_id", str(session_id))
        .execute()
        .data
        or []
    )
    prior_in = sum(r.get("tokens_in") or 0 for r in prior)
    prior_out = sum(r.get("tokens_out") or 0 for r in prior)
    prior_cents = sum(r.get("cost_cents") or 0 for r in prior)

    total = cost_cents_exact(provider, model, prior_in + tokens_in, prior_out + tokens_out) or 0.0
    return max(0, round(total) - prior_cents)


def _save_message(
    client,
    tenant_id: UUID,
    session_id: UUID,
    role: str,
    content,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
) -> str:
    row: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "session_id": str(session_id),
        "role": role,
        "content": content if isinstance(content, list | dict) else {"text": content},
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }
    if tokens_in or tokens_out:
        row["provider"] = settings.agent_provider
        row["model"] = settings.agent_model
        try:
            row["cost_cents"] = _cost_cents_for_turn(client, session_id, tokens_in or 0, tokens_out or 0)
        except Exception as exc:  # noqa: BLE001 - accounting must never drop a message
            logger.warning("cost_accounting_failed", event_type="write", error=str(exc)[:200])
    return client.table("agent_messages").insert(row).execute().data[0]["id"]
