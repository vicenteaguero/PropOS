from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SessionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class AnitaSessionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    title: str | None = None
    status: SessionStatus
    metadata: dict[str, Any] = {}
    started_at: datetime
    last_activity_at: datetime
    closed_at: datetime | None = None

    model_config = {"from_attributes": True}


class TranscribeRequest(BaseModel):
    """Used when transcript came from browser Web Speech API."""

    text: str
    session_id: UUID | None = None
    media_file_id: UUID | None = None
    language: str = "es-CL"


class TranscribeResponse(BaseModel):
    transcript_id: UUID
    text: str
    language: str | None = None
    duration_seconds: float | None = None
    source: str  # browser_speech | groq_whisper | openai_whisper | manual_text


class ChatRequest(BaseModel):
    session_id: UUID
    user_text: str | None = None
    transcript_id: UUID | None = None


class ChatMessageBlock(BaseModel):
    type: str  # text | tool_use | tool_result
    text: str | None = None
    name: str | None = None
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    tool_call_id: str | None = None


class AnitaMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: list[ChatMessageBlock] | dict[str, Any] | str
    provider: str | None = None
    model: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_cents: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    assistant_text: str
    proposals_created: list[UUID] = []
    provider_used: str
    tokens_used: dict[str, int] = {}
    tool_calls: list[dict[str, Any]] = []
