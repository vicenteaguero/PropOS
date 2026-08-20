from __future__ import annotations

import json
from functools import partial
from io import BytesIO
from typing import Any
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.dependencies import (
    get_current_user,
    get_tenant_id,
    require_role,
    require_scope,
)
from app.core.supabase.client import get_supabase_client
from app.features.agent.audio_store import store_voice_note
from app.features.agent.chat import run_chat_turn
from app.features.agent.schemas import (
    AgentSessionResponse,
    AgentSessionUpdate,
    ChatRequest,
    TranscribeResponse,
)
from app.features.agent.transcribe import (
    TranscriptionError,
    TranscriptionProviderError,
    TranscriptionQuotaError,
    transcribe_audio,
)

# Conversational agent is admin-only (spec: "solamente los administradores
# tendrán acceso al agente"). The Kapso/WhatsApp inbound path drives
# run_chat_turn directly via channels and does not pass through this router,
# so phone access stays gated by user_phones, not by these dependencies.
router = APIRouter(
    prefix="/agent",
    dependencies=[Depends(require_role("ADMIN")), Depends(require_scope("agent"))],
)

# ──────────────────────────── sessions ────────────────────────────


def _delete_empty_sessions(client: Any, user_id: str, tenant_id: str) -> None:
    """Delete this user's sessions that have no user-authored message — the
    "opened Propo then left without typing" threads that otherwise pile up as
    trash. ``agent_messages`` cascade-delete with the session; transcripts are
    preserved (their FK is ``ON DELETE SET NULL``)."""
    owned = (
        client.table("agent_sessions").select("id").eq("user_id", user_id).eq("tenant_id", tenant_id).execute().data
        or []
    )
    owned_ids = [s["id"] for s in owned]
    if not owned_ids:
        return
    with_user_msg = (
        # tenant-safe: scoped by agent session, which is itself tenant-bound
        client.table("agent_messages")
        .select("session_id")
        .in_("session_id", owned_ids)
        .eq("role", "user")
        .execute()
        .data
        or []
    )
    non_empty = {m["session_id"] for m in with_user_msg}
    empty_ids = [sid for sid in owned_ids if sid not in non_empty]
    if empty_ids:
        # tenant-safe: scoped by agent session, which is itself tenant-bound
        client.table("agent_sessions").delete().in_("id", empty_ids).execute()


@router.post(
    "/sessions",
    response_model=AgentSessionResponse,
    status_code=201,
    tags=["agent-sessions"],
)
async def create_or_resume_session(
    force_new: bool = False,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Open a session.

    With ``force_new=true`` the most recent OPEN session is closed and a
    fresh one starts — used by the "Nueva" button.

    Otherwise we resume the most recent OPEN session (any ``source``,
    including ``whatsapp``) whose ``last_activity_at`` is within
    ``AGENT_SESSION_INACTIVITY_HOURS``. This lets a broker continue on web
    a thread they started on WhatsApp, and vice versa. If nothing recent
    exists we open a new session.
    """
    from datetime import UTC, datetime, timedelta

    from app.core.config.settings import settings

    client = get_supabase_client()
    user_id = current_user["id"]

    if force_new:
        client.table("agent_sessions").update({"status": "CLOSED", "closed_at": datetime.now(UTC).isoformat()}).eq(
            "user_id", user_id
        ).eq("tenant_id", str(tenant_id)).eq("status", "OPEN").execute()
        # Sweep abandoned empty sessions (incl. the ones just closed) before
        # opening a fresh one, so the history never accrues "(sin mensajes)" trash.
        _delete_empty_sessions(client, user_id, str(tenant_id))
    else:
        cutoff = (datetime.now(UTC) - timedelta(hours=settings.agent_session_inactivity_hours)).isoformat()
        existing = (
            client.table("agent_sessions")
            .select("*")
            .eq("user_id", user_id)
            .eq("tenant_id", str(tenant_id))
            .eq("status", "OPEN")
            .gte("last_activity_at", cutoff)
            .order("last_activity_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if existing:
            return existing[0]

    return (
        client.table("agent_sessions")
        .insert(
            {
                "id": str(uuid4()),
                "tenant_id": str(tenant_id),
                "user_id": user_id,
                "status": "OPEN",
            }
        )
        .execute()
        .data[0]
    )


@router.get(
    "/sessions",
    tags=["agent-sessions"],
)
async def list_sessions(
    limit: int = 30,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    """List recent sessions for the current user with a short preview
    (first user message) so the chat history drawer can render them."""
    client = get_supabase_client()
    user_id = current_user["id"]

    sessions = (
        client.table("agent_sessions")
        .select("id, status, started_at, last_activity_at, closed_at")
        .eq("user_id", user_id)
        .eq("tenant_id", str(tenant_id))
        .order("last_activity_at", desc=True)
        .limit(limit)
        .execute()
        .data
        or []
    )
    if not sessions:
        return []

    ids = [s["id"] for s in sessions]
    previews = (
        # tenant-safe: scoped by agent session, which is itself tenant-bound
        client.table("agent_messages")
        .select("session_id, content, created_at, role")
        .in_("session_id", ids)
        .eq("role", "user")
        .order("created_at")
        .execute()
        .data
        or []
    )
    seen: dict[str, str] = {}
    for m in previews:
        sid = m["session_id"]
        if sid in seen:
            continue
        content = m.get("content") or {}
        text = ""
        if isinstance(content, dict):
            text = content.get("text") or ""
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text = block.get("text") or ""
                    break
        seen[sid] = (text or "")[:80]

    for s in sessions:
        s["preview"] = seen.get(s["id"], "")
    # Hide empty conversations (no user-authored message) — abandoned sessions
    # shouldn't clutter the history list; the active chat pane is driven by the
    # session id in component state, not by this list.
    return [s for s in sessions if s["id"] in seen]


@router.patch(
    "/sessions/{session_id}",
    response_model=AgentSessionResponse,
    tags=["agent-sessions"],
)
async def update_session(
    session_id: UUID,
    payload: AgentSessionUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    from datetime import UTC, datetime

    data = payload.model_dump(exclude_unset=True)
    if data.get("status") == "CLOSED":
        data["closed_at"] = datetime.now(UTC).isoformat()
    if "status" in data and hasattr(data["status"], "value"):
        data["status"] = data["status"].value

    client = get_supabase_client()
    rows = (
        client.table("agent_sessions")
        .update(data)
        .eq("id", str(session_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="session not found")
    return rows[0]


# ──────────────────────────── messages ────────────────────────────


@router.get("/sessions/{session_id}/messages", tags=["agent-messages"])
async def list_messages(
    session_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    limit: int = 100,
) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("agent_messages")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("tenant_id", str(tenant_id))
        .order("created_at")
        .limit(limit)
        .execute()
        .data
    )


@router.post("/sessions/{session_id}/messages", tags=["agent-messages"])
async def post_message(
    session_id: UUID,
    payload: ChatRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Stream one assistant turn over SSE. Body: {user_text?, transcript_id?}."""
    client = get_supabase_client()
    user_text = payload.user_text or ""
    if payload.transcript_id and not user_text:
        transcript = (
            client.table("agent_transcripts")
            .select("text")
            .eq("id", str(payload.transcript_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        user_text = transcript["text"] if transcript else ""

    if not user_text.strip():
        raise HTTPException(status_code=400, detail="user_text or transcript_id required")

    async def event_stream():
        async for event in run_chat_turn(
            session_id=session_id,
            tenant_id=tenant_id,
            user_id=UUID(current_user["id"]),
            user_text=user_text,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ──────────────────────────── transcripts ────────────────────────────


@router.post(
    "/transcripts",
    response_model=TranscribeResponse,
    status_code=201,
    tags=["agent-transcripts"],
)
async def create_transcript(
    audio: UploadFile = File(...),
    session_id: UUID | None = Form(default=None),
    media_file_id: UUID | None = Form(default=None),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Upload audio → server STT (Whisper) → persist audio + transcript."""
    filename = audio.filename or "audio.webm"
    raw = await audio.read()

    # `transcribe_audio` is fully synchronous (HTTP call to Whisper + a handful
    # of Supabase reads for the vocab). Calling it inline would block the event
    # loop for every other request on this worker until Groq answers.
    try:
        result = await anyio.to_thread.run_sync(
            partial(
                transcribe_audio,
                BytesIO(raw),
                filename,
                tenant_id=tenant_id,
            )
        )
    except TranscriptionQuotaError as exc:
        # Retrying later genuinely works, so say so instead of looking broken.
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except TranscriptionProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except TranscriptionError as exc:
        # Nothing is configured — a deployment problem, not a runtime one.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Keep the original audio: it is the primary evidence behind an amount or
    # an address the broker dictated, and the only way to reprocess a bad
    # transcription later.
    if media_file_id is None:
        media_file_id = await anyio.to_thread.run_sync(
            partial(
                store_voice_note,
                raw,
                tenant_id=tenant_id,
                user_id=current_user["id"],
                filename=filename,
                mime=audio.content_type,
            )
        )

    client = get_supabase_client()
    row = (
        client.table("agent_transcripts")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "session_id": str(session_id) if session_id else None,
                "media_file_id": str(media_file_id) if media_file_id else None,
                "source": result["source"],
                "language": result.get("language"),
                "duration_seconds": result.get("duration"),
                "text": result["text"],
                "raw_response": result.get("raw"),
                "created_by": current_user["id"],
            }
        )
        .execute()
        .data[0]
    )
    return {
        "transcript_id": row["id"],
        "text": row["text"],
        "language": row.get("language"),
        "duration_seconds": row.get("duration_seconds"),
        "source": row["source"],
    }
