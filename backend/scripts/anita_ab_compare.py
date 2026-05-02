"""Side-by-side comparison: OLD pipeline (run_chat_turn with 16 tools) vs
NEW classifier (single-call KV).

Prints exact token counts from Groq's `usage` field (authoritative).
"""

from __future__ import annotations

import asyncio
import os
import sys
from uuid import uuid4

from app.core.supabase.client import get_supabase_client
from app.features.anita.chat import run_chat_turn
from app.features.anita.classifier import classify

PROMPT = (
    "Hola Anita, quería pedirte por favor que registres una visita que hicimos "
    "con Juan Pérez a la casa de Apoquindo, estuvimos cerca de media hora "
    "recorriendo, le interesó mucho la cocina aunque encontró pequeña la pieza "
    "principal."
)


async def run_old(prompt: str, tenant_id, user_id) -> tuple[int, int, list[str]]:
    """Drive run_chat_turn (old pipeline) once. Return (tokens_in, tokens_out, tool_calls)."""
    client = get_supabase_client()
    sid = uuid4()
    client.table("anita_sessions").insert(
        {"id": str(sid), "tenant_id": str(tenant_id), "user_id": str(user_id), "status": "OPEN"}
    ).execute()

    tin = tout = 0
    tools_called: list[str] = []
    async for ev in run_chat_turn(session_id=sid, tenant_id=tenant_id, user_id=user_id, user_text=prompt):
        et = ev.get("type")
        if et == "tool_use":
            tools_called.append(ev.get("name", "?"))
        if et == "done":
            t = ev.get("tokens", {})
            tin = t.get("in", 0) or 0
            tout = t.get("out", 0) or 0
    return tin, tout, tools_called


async def run_new(prompt: str) -> tuple[int, int, dict]:
    r = await classify(prompt)
    return r.tokens_in, r.tokens_out, {"intent": r.intent, **r.fields}


async def main() -> None:
    # Use the test schema/seed if env vars suggest integration setup; else require
    # the caller to pass tenant_id (rare).
    tenant_id_str = os.environ.get("ANITA_AB_TENANT_ID")
    if not tenant_id_str:
        # Quick path: skip OLD pipeline (which needs a real tenant + snapshot).
        print("[skipping OLD pipeline — set ANITA_AB_TENANT_ID to compare]\n")
        new_in, new_out, new_result = await run_new(PROMPT)
        print("NEW classifier:")
        print(f"  result      : {new_result}")
        print(f"  tokens_in   : {new_in}")
        print(f"  tokens_out  : {new_out}")
        print(f"  tokens_total: {new_in + new_out}")
        return

    from uuid import UUID
    tid = UUID(tenant_id_str)
    uid = UUID(os.environ.get("ANITA_AB_USER_ID", "00000000-0000-0000-0000-000000000001"))

    print(f"prompt: {PROMPT}\n")

    print("OLD pipeline (run_chat_turn, 16 tools, multi-turn):")
    old_in, old_out, tools = await run_old(PROMPT, tid, uid)
    print(f"  tools called: {tools}")
    print(f"  tokens_in   : {old_in}")
    print(f"  tokens_out  : {old_out}")
    print(f"  tokens_total: {old_in + old_out}\n")

    print("NEW classifier (single call, KV output):")
    new_in, new_out, new_result = await run_new(PROMPT)
    print(f"  result      : {new_result}")
    print(f"  tokens_in   : {new_in}")
    print(f"  tokens_out  : {new_out}")
    print(f"  tokens_total: {new_in + new_out}\n")

    if old_in + old_out > 0:
        ratio = (old_in + old_out) / max(1, new_in + new_out)
        print(f"reduction: {ratio:.1f}× fewer tokens (NEW vs OLD)")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        PROMPT = " ".join(sys.argv[1:])
    asyncio.run(main())
