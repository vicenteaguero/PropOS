"""Try Anita on an arbitrary audio file or a typed prompt.

Examples:
  poetry run python scripts/anita_try.py --audio path/to/audio.mp3
  poetry run python scripts/anita_try.py --text "anota visita con juan en apoquindo, 30 min"
  poetry run python scripts/anita_try.py --audio x.wav --tenant 7c9...   # use a real tenant

Defaults to a fresh propos_test tenant (auto-seeded with Juan Pérez,
María Soto, depto Providencia, etc.) and cleans up at exit. Pass
--keep to leave the seed tenant in place for follow-up runs.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from uuid import UUID, uuid4

from app.core.supabase.client import get_supabase_client
from app.features.anita.chat import run_chat_turn
from app.features.anita.transcribe import transcribe_audio


async def _bootstrap_tenant() -> tuple[UUID, UUID, list[str]]:
    """Insert a tiny seed in propos_test so the resolver has data to match.
    Returns (tenant_id, user_id, table_list_for_cleanup)."""
    c = get_supabase_client()
    tid = uuid4()
    uid = uuid4()
    c.table("tenants").insert({"id": str(tid), "name": "anita-try", "slug": "anaida"}).execute()
    c.table("contacts").insert(
        [
            {"id": str(uuid4()), "tenant_id": str(tid), "full_name": "Juan Pérez", "type": "BUYER", "is_draft": False},
            {"id": str(uuid4()), "tenant_id": str(tid), "full_name": "María Soto", "type": "SELLER", "is_draft": False},
            {"id": str(uuid4()), "tenant_id": str(tid), "full_name": "María López", "type": "BUYER", "is_draft": False},
            {
                "id": str(uuid4()),
                "tenant_id": str(tid),
                "full_name": "Pedro Kast",
                "type": "INVESTOR",
                "is_draft": False,
            },
        ]
    ).execute()
    c.table("properties").insert(
        [
            {
                "id": str(uuid4()),
                "tenant_id": str(tid),
                "title": "Casa Apoquindo 1234",
                "address": "Av. Apoquindo 1234, Las Condes",
                "status": "AVAILABLE",
                "is_draft": False,
            },
            {
                "id": str(uuid4()),
                "tenant_id": str(tid),
                "title": "Depto Providencia 567",
                "address": "Av. Providencia 567",
                "status": "RESERVED",
                "is_draft": False,
            },
        ]
    ).execute()
    return tid, uid, ["pending_proposals", "anita_messages", "anita_sessions", "contacts", "properties", "tenants"]


def _cleanup(tid: UUID, tables: list[str]) -> None:
    c = get_supabase_client()
    schema = c.schema("propos_test") if hasattr(c, "schema") else c
    for t in tables:
        try:
            if t == "tenants":
                schema.table(t).delete().eq("id", str(tid)).execute()
            else:
                schema.table(t).delete().eq("tenant_id", str(tid)).execute()
        except Exception:
            pass


async def main() -> None:
    p = argparse.ArgumentParser()
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--audio", type=Path, help="path to .mp3/.wav/.m4a/.webm")
    src.add_argument("--text", type=str, help="prompt directo, salta Whisper")
    p.add_argument("--tenant", type=str, help="tenant_id existente (skip seed)")
    p.add_argument("--keep", action="store_true", help="no borrar el tenant seed al terminar")
    args = p.parse_args()

    # 2a. Tenant FIRST (so the Whisper vocab can use real DB names).
    cleanup_tables: list[str] = []
    if args.tenant:
        tid = UUID(args.tenant)
        uid = uuid4()
    else:
        tid, uid, cleanup_tables = await _bootstrap_tenant()

    # 1. Whisper if audio (with tenant-scoped vocab).
    if args.audio:
        if not args.audio.exists():
            print(f"audio not found: {args.audio}", file=sys.stderr)
            sys.exit(1)
        t0 = time.perf_counter()
        with args.audio.open("rb") as f:
            tr = transcribe_audio(f, args.audio.name, tenant_id=tid)
        ms = int((time.perf_counter() - t0) * 1000)
        print("\n── Whisper ──")
        print(f"  source   : {tr.get('source')}")
        print(f"  language : {tr.get('language')}")
        print(f"  duration : {tr.get('duration')}s")
        print(f"  latency  : {ms}ms")
        print(f"  text     : {tr['text']}")
        prompt = tr["text"]
    else:
        prompt = args.text

    # 3. Run Anita pipeline.
    c = get_supabase_client()
    sid = uuid4()
    c.table("anita_sessions").insert(
        {
            "id": str(sid),
            "tenant_id": str(tid),
            "user_id": str(uid),
            "status": "OPEN",
        }
    ).execute()

    print("\n── Anita pipeline ──")
    print(f"  prompt: {prompt}\n")
    t0 = time.perf_counter()
    events: list[dict] = []
    async for ev in run_chat_turn(session_id=sid, tenant_id=tid, user_id=uid, user_text=prompt):
        events.append(ev)
        et = ev.get("type")
        if et == "tool_use":
            print(f"  → tool_use   {ev.get('name')}  args={json.dumps(ev.get('args', {}), ensure_ascii=False)[:200]}")
        elif et == "text":
            print(f"  → text       {ev.get('text')}")
        elif et == "done":
            print(f"  → done       proposals={ev.get('proposals_created')}")
            print(f"               tokens={ev.get('tokens')}  intents={ev.get('intents')}")
    ms = int((time.perf_counter() - t0) * 1000)
    print(f"\n  total latency: {ms}ms")

    # 4. DB readback (proposals).
    try:
        rows = (
            c.schema("propos_test")
            .table("pending_proposals")
            .select("id,kind,payload")
            .eq("tenant_id", str(tid))
            .execute()
            .data
        )
        print(f"\n── Proposals creadas en BD ({len(rows)}) ──")
        for r in rows:
            print(f"  {r['id'][:8]}  {r['kind']}")
            print(f"    payload: {json.dumps(r['payload'], ensure_ascii=False)[:300]}")
    except Exception as exc:
        print(f"  (no se pudo leer pending_proposals: {exc})")

    if cleanup_tables and not args.keep:
        _cleanup(tid, cleanup_tables)


if __name__ == "__main__":
    asyncio.run(main())
