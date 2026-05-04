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
from app.features.anita.classifier import classify, extract_details
from app.features.anita.context import load_snapshot
from app.features.anita.dispatcher import dispatch
from app.features.anita.intent_registry import get as get_intent_spec
from app.features.anita.intent_registry import needs_pass_two, normalize_fields, real_captures
from app.features.anita.postprocess import dedupe_actions, expand_money_units, normalize_rut
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
            blocks.append({
                "type": "tool_use",
                "id": pid,
                "name": outcome.get("proposal_kind", ""),
                "input": action.fields,
            })

        response_chunks.append(_format_response(action.intent, outcome, resolved))

    assistant_text = " ".join(response_chunks) or "Listo."
    yield {"type": "text", "text": assistant_text}

    # Persist assistant turn.
    blocks.insert(0, {"type": "text", "text": assistant_text})
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
