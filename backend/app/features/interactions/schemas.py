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


# Capability strings the broker grants per interaction via `audience_caps`
# (see `sharing/service.py`). "owner" is the audience the Dueño reads.
OWNER_AUDIENCE = "owner"
CAP_VIEW = "view"
CAP_VIEW_VISITOR_IDENTITY = "view_visitor_identity"


class OwnerVisitResponse(BaseModel):
    """What the Dueño sees of a visit — deliberately narrower than the staff view.

    No `body`, no participants, no `created_by`: the owner learns that a visit
    happened and how long it lasted. The `summary` names the visitor, so it is
    only carried when the broker granted `view_visitor_identity` on that row.
    """

    id: UUID
    kind: InteractionKind
    occurred_at: datetime | None = None
    duration_minutes: int | None = None
    summary: str | None = None
    audience_caps: dict[str, list[str]] = {}

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> OwnerVisitResponse:
        caps = row.get("audience_caps") or {}
        owner_caps = caps.get(OWNER_AUDIENCE) or []
        return cls(
            id=row["id"],
            kind=row["kind"],
            occurred_at=row.get("occurred_at"),
            duration_minutes=row.get("duration_minutes"),
            summary=row.get("summary") if CAP_VIEW_VISITOR_IDENTITY in owner_caps else None,
            audience_caps=caps,
        )


def shared_with_owner(row: dict[str, Any]) -> bool:
    """Sharing is opt-in per interaction — the broker must grant `view`."""
    caps = row.get("audience_caps") or {}
    return CAP_VIEW in (caps.get(OWNER_AUDIENCE) or [])


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
