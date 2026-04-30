from __future__ import annotations

import json
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_current_user, get_tenant_id
from app.core.supabase.client import get_supabase_client
from app.features.anita.chat import run_chat_turn
from app.features.anita.schemas import (
    AnitaSessionResponse,
    ChatRequest,
    TranscribeRequest,
    TranscribeResponse,
)
from app.features.anita.transcribe import TranscriptionError, transcribe_audio

router = APIRouter(prefix="/anita", tags=["anita"])


@router.post("/sessions", response_model=AnitaSessionResponse, status_code=201)
async def create_or_resume_session(
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    client = get_supabase_client()
    user_id = current_user["id"]

    existing = (
        client.table("anita_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("tenant_id", str(tenant_id))
        .eq("status", "OPEN")
        .order("last_activity_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return existing[0]

    return (
        client.table("anita_sessions")
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


@router.get("/sessions/{session_id}/messages")
async def list_messages(
    session_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    limit: int = 100,
) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("anita_messages")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("tenant_id", str(tenant_id))
        .order("created_at")
        .limit(limit)
        .execute()
        .data
    )


@router.post("/transcribe-text", response_model=TranscribeResponse)
async def transcribe_text(
    payload: TranscribeRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Persist a browser-side (Web Speech API) transcript without re-running STT."""
    client = get_supabase_client()
    row = (
        client.table("anita_transcripts")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "session_id": str(payload.session_id) if payload.session_id else None,
                "media_file_id": str(payload.media_file_id) if payload.media_file_id else None,
                "source": "browser_speech",
                "language": payload.language,
                "text": payload.text,
                "created_by": current_user["id"],
            }
        )
        .execute()
        .data[0]
    )
    return {
        "transcript_id": row["id"],
        "text": row["text"],
        "language": row["language"],
        "duration_seconds": None,
        "source": "browser_speech",
    }


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    session_id: UUID | None = Form(default=None),
    media_file_id: UUID | None = Form(default=None),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    try:
        result = transcribe_audio(audio.file, audio.filename or "audio.webm")
    except TranscriptionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    client = get_supabase_client()
    row = (
        client.table("anita_transcripts")
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


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    client = get_supabase_client()
    user_text = payload.user_text or ""
    if payload.transcript_id and not user_text:
        transcript = (
            client.table("anita_transcripts")
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
            session_id=payload.session_id,
            tenant_id=tenant_id,
            user_id=UUID(current_user["id"]),
            user_text=user_text,
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/sessions/{session_id}/close", response_model=AnitaSessionResponse)
async def close_session(
    session_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    from datetime import UTC, datetime

    client = get_supabase_client()
    return (
        client.table("anita_sessions")
        .update(
            {"status": "CLOSED", "closed_at": datetime.now(UTC).isoformat()}
        )
        .eq("id", str(session_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data[0]
    )
