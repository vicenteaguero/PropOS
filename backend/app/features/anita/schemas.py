from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


MessageRole = Literal["user", "assistant", "tool", "system"]
TranscriptSource = Literal["browser_speech", "groq_whisper", "openai_whisper", "manual_text"]


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


class AnitaSessionUpdate(BaseModel):
    status: SessionStatus | None = None
    title: str | None = None


class TranscribeResponse(BaseModel):
    transcript_id: UUID
    text: str
    language: str | None = None
    duration_seconds: float | None = None
    source: TranscriptSource


class ChatRequest(BaseModel):
    user_text: str | None = None
    transcript_id: UUID | None = None


# ── Discriminated union for chat content blocks ────────────────────────

class TextBlock(BaseModel):
    type: Literal["text"] = "text"
    text: str


class ToolUseBlock(BaseModel):
    type: Literal["tool_use"] = "tool_use"
    name: str
    input: dict[str, Any] = {}
    tool_call_id: str | None = None


class ToolResultBlock(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    tool_call_id: str | None = None
    output: dict[str, Any] = {}


ChatMessageBlock = Annotated[
    TextBlock | ToolUseBlock | ToolResultBlock,
    Field(discriminator="type"),
]


class AnitaMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: MessageRole
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
