"""Anita conversation orchestrator: streams LLM output, dispatches tools.

Flow:
1. Load session messages (last N)
2. Stream from LLMClient with tools
3. Each tool_use → dispatch executor → push tool_result back
4. Loop until message_stop with no more tools (or hard cap reached)
5. Persist all messages + tool calls to DB
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from app.core.config.settings import settings
from app.core.supabase.client import get_supabase_client
from app.features.anita.context import load_snapshot
from app.features.anita.llm import StreamEvent, get_llm_client
from app.features.anita.system_prompt import build_system_prompt
from app.features.anita.tools.definitions import all_tools
from app.features.anita.tools.executors import dispatch_tool

logger = logging.getLogger("ANITA_CHAT")


async def run_chat_turn(
    session_id: UUID,
    tenant_id: UUID,
    user_id: UUID,
    user_text: str,
) -> AsyncIterator[dict[str, Any]]:
    """Generator yielding SSE-style events to the frontend.

    Events: {type:'text', text:str} | {type:'tool_use', name, args}
            | {type:'proposals', ids:[...]} | {type:'done', ...}
    """
    client = get_supabase_client()
    llm = get_llm_client()
    snapshot = load_snapshot(tenant_id)
    system = build_system_prompt(snapshot)
    tools = all_tools()

    history = (
        client.table("anita_messages")
        .select("role,content")
        .eq("session_id", str(session_id))
        .order("created_at")
        .limit(30)
        .execute()
        .data
    )
    messages: list[dict[str, Any]] = [
        {
            "role": m["role"],
            "content": m["content"] if isinstance(m["content"], str) else json.dumps(m["content"]),
        }
        for m in history
    ]
    messages.append({"role": "user", "content": user_text})

    _save_message(client, tenant_id, session_id, "user", user_text)

    proposals_created: list[str] = []
    total_in = 0
    total_out = 0
    iterations = 0

    while iterations < settings.anita_max_tool_calls_per_turn:
        iterations += 1
        assistant_text_buf: list[str] = []
        tool_calls_pending: list[dict[str, Any]] = []

        async for event in llm.chat_stream(messages, tools, system):
            if event.type == "text_delta":
                assistant_text_buf.append(event.text or "")
                yield {"type": "text", "text": event.text}
            elif event.type == "tool_use":
                tool_calls_pending.append(
                    {
                        "id": event.tool_use_id,
                        "name": event.tool_name,
                        "input": event.tool_input or {},
                    }
                )
                yield {
                    "type": "tool_use",
                    "name": event.tool_name,
                    "args": event.tool_input,
                }
            elif event.type == "message_stop":
                if event.tokens_in:
                    total_in += event.tokens_in
                if event.tokens_out:
                    total_out += event.tokens_out

        assistant_text = "".join(assistant_text_buf)

        # Persist assistant turn
        assistant_blocks: list[dict[str, Any]] = []
        if assistant_text:
            assistant_blocks.append({"type": "text", "text": assistant_text})
        for tc in tool_calls_pending:
            assistant_blocks.append(
                {
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["input"],
                }
            )

        assistant_msg_id = _save_message(
            client,
            tenant_id,
            session_id,
            "assistant",
            assistant_blocks if assistant_blocks else assistant_text,
            provider=llm.provider_name,
            model=llm.model,
            tokens_in=total_in,
            tokens_out=total_out,
        )

        if not tool_calls_pending:
            # End of turn — model said its final piece
            break

        # Update OpenAI-format messages list for next iteration
        messages.append(
            {
                "role": "assistant",
                "content": assistant_text or "",
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["input"]),
                        },
                    }
                    for tc in tool_calls_pending
                ],
            }
        )

        # Execute tools, push results back
        for tc in tool_calls_pending:
            tool_input = tc["input"]
            # Llama-class models occasionally emit malformed tool JSON.
            # The openai-compat adapter flags it via {_malformed: <raw>}.
            if isinstance(tool_input, dict) and tool_input.get("_malformed"):
                result = {
                    "error": "malformed_json",
                    "message": (
                        "Tu llamada a la herramienta trae JSON inválido. "
                        "Vuelve a intentar con JSON válido y sin explicaciones."
                    ),
                    "raw": tool_input.get("_malformed"),
                }
                status = "malformed"
            else:
                try:
                    result = dispatch_tool(
                        tc["name"], tool_input, tenant_id, user_id, session_id
                    )
                    status = "ok"
                except Exception as exc:
                    result = {"error": str(exc)}
                    status = "error"

            if isinstance(result, dict) and result.get("proposal_id"):
                proposals_created.append(result["proposal_id"])

            _save_tool_call(
                client,
                tenant_id,
                assistant_msg_id,
                tc["name"],
                tc["input"],
                result,
                status,
                proposal_id=result.get("proposal_id") if isinstance(result, dict) else None,
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                }
            )
            _save_message(
                client,
                tenant_id,
                session_id,
                "tool",
                {"tool_use_id": tc["id"], "name": tc["name"], "result": result},
            )

    # Update session last_activity
    from datetime import UTC, datetime

    client.table("anita_sessions").update(
        {"last_activity_at": datetime.now(UTC).isoformat()}
    ).eq("id", str(session_id)).eq("tenant_id", str(tenant_id)).execute()

    yield {
        "type": "done",
        "proposals_created": proposals_created,
        "tokens": {"in": total_in, "out": total_out},
        "provider": llm.provider_name,
    }


def _save_message(
    client,
    tenant_id: UUID,
    session_id: UUID,
    role: str,
    content,
    provider: str | None = None,
    model: str | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
) -> str:
    row = {
        "tenant_id": str(tenant_id),
        "session_id": str(session_id),
        "role": role,
        "content": content if isinstance(content, (list, dict)) else {"text": content},
        "provider": provider,
        "model": model,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
    }
    return client.table("anita_messages").insert(row).execute().data[0]["id"]


def _save_tool_call(
    client,
    tenant_id: UUID,
    message_id: str,
    tool_name: str,
    inp: dict,
    out: Any,
    status: str,
    proposal_id: str | None = None,
) -> None:
    client.table("anita_tool_calls").insert(
        {
            "tenant_id": str(tenant_id),
            "message_id": message_id,
            "tool_name": tool_name,
            "input": inp,
            "output": out if isinstance(out, dict) else {"value": out},
            "status": status,
            "proposal_id": proposal_id,
        }
    ).execute()
