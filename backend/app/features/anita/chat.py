"""Anita conversation orchestrator (v2).

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

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.anita.classifier import classify
from app.features.anita.context import load_snapshot
from app.features.anita.dispatcher import dispatch
from app.features.anita.resolver import resolve

logger = get_logger("ANITA_CHAT")


async def run_chat_turn(
    session_id: UUID,
    tenant_id: UUID,
    user_id: UUID,
    user_text: str,
) -> AsyncIterator[dict[str, Any]]:
    """Run one turn end-to-end. Streams events for the frontend."""
    client = get_supabase_client()
    t0 = time.perf_counter()

    _save_message(client, tenant_id, session_id, "user", user_text)

    classification = await classify(user_text)
    logger.info(
        "classifier_done",
        event_type="llm",
        intent=classification.intent,
        tokens_in=classification.tokens_in,
        tokens_out=classification.tokens_out,
    )

    snapshot = load_snapshot(tenant_id)
    resolved = resolve(classification.fields, snapshot, intent=classification.intent)

    outcome = dispatch(
        classification.intent,
        resolved,
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )

    proposals_created: list[str] = []
    assistant_text = _format_response(classification.intent, outcome, resolved)

    # Mirror the old SSE shape so the frontend keeps working.
    yield {"type": "tool_use", "name": _tool_name_for(classification.intent, outcome),
           "args": {**classification.fields, **{k: str(v) for k, v in _entity_ids(resolved).items()}}}

    if outcome.get("kind") == "proposal" and (pid := outcome.get("proposal_id")):
        proposals_created.append(pid)

    yield {"type": "text", "text": assistant_text}

    # Persist assistant turn.
    blocks: list[dict[str, Any]] = [{"type": "text", "text": assistant_text}]
    if outcome.get("kind") == "proposal":
        blocks.append({
            "type": "tool_use",
            "id": outcome.get("proposal_id", ""),
            "name": outcome.get("kind", ""),
            "input": classification.fields,
        })

    _save_message(
        client, tenant_id, session_id, "assistant", blocks,
        tokens_in=classification.tokens_in,
        tokens_out=classification.tokens_out,
    )

    from datetime import UTC, datetime
    client.table("anita_sessions").update(
        {"last_activity_at": datetime.now(UTC).isoformat()}
    ).eq("id", str(session_id)).eq("tenant_id", str(tenant_id)).execute()

    yield {
        "type": "done",
        "proposals_created": proposals_created,
        "tokens": {"in": classification.tokens_in, "out": classification.tokens_out},
        "intent": classification.intent,
        "outcome_kind": outcome.get("kind"),
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
    if kind == "needs_sql":
        return "query_sql"
    if kind == "out_of_scope":
        return "out_of_scope"
    return {
        "log_interaction":     "propose_log_interaction",
        "create_person":       "propose_create_person",
        "create_task":         "propose_create_task",
        "log_transaction":     "propose_log_transaction",
        "create_organization": "propose_create_organization",
        "add_note":            "propose_add_note",
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
            names = ", ".join(c.get("label") or c.get("raw") or "?"
                              for cand in cands for c in cand.get("candidates", []))[:200]
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
        return "Esa consulta necesita SQL libre — pendiente de implementar."
    if kind == "proposal":
        summary_es = (outcome.get("summary_es") or "").strip()
        if summary_es:
            return f"Listo, dejé pendiente: {summary_es}."
        return "Listo, dejé pendiente la propuesta para que la revises."
    return "Listo."


def _save_message(
    client,
    tenant_id: UUID,
    session_id: UUID,
    role: str,
    content,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
) -> str:
    row = {
        "tenant_id": str(tenant_id),
        "session_id": str(session_id),
        "role": role,
        "content": content if isinstance(content, list | dict) else {"text": content},
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }
    return client.table("anita_messages").insert(row).execute().data[0]["id"]
