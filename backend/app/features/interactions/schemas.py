from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InteractionKind(str, Enum):
    VISIT = "VISIT"
    CALL = "CALL"
    EMAIL = "EMAIL"
    WHATSAPP_LOG = "WHATSAPP_LOG"
    NOTE = "NOTE"
    MEETING = "MEETING"
    SHOWING = "SHOWING"
    OTHER = "OTHER"


class InteractionSentiment(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


class InteractionTargetKind(str, Enum):
    PROPERTY = "PROPERTY"
    PROJECT = "PROJECT"
    OPPORTUNITY = "OPPORTUNITY"
    PLACE = "PLACE"


class InteractionTargetSpec(BaseModel):
    target_kind: InteractionTargetKind
    property_id: UUID | None = None
    project_id: UUID | None = None
    opportunity_id: UUID | None = None
    place_id: UUID | None = None


class InteractionParticipantSpec(BaseModel):
    person_id: UUID
    role: str | None = None


class InteractionBase(BaseModel):
    kind: InteractionKind
    occurred_at: datetime | None = None
    duration_minutes: int | None = None
    channel: str | None = None
    summary: str | None = None
    body: str | None = None
    sentiment: InteractionSentiment | None = None


class InteractionCreate(InteractionBase):
    participants: list[InteractionParticipantSpec] = []
    targets: list[InteractionTargetSpec] = []
    raw_transcript_id: UUID | None = None


class InteractionUpdate(BaseModel):
    kind: InteractionKind | None = None
    occurred_at: datetime | None = None
    duration_minutes: int | None = None
    channel: str | None = None
    summary: str | None = None
    body: str | None = None
    sentiment: InteractionSentiment | None = None


class InteractionResponse(InteractionBase):
    id: UUID
    tenant_id: UUID
    source: str
    raw_transcript_id: UUID | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    participants: list[dict[str, Any]] = []
    targets: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}
