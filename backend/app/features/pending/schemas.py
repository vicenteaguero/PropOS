from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ProposalStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"


class PendingProposalResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    anita_session_id: UUID
    proposed_by_user: UUID
    kind: str
    target_table: str | None = None
    target_row_id: UUID | None = None
    payload: dict[str, Any]
    resolved_payload: dict[str, Any] | None = None
    ambiguity: dict[str, Any] | None = None
    status: ProposalStatus
    confidence: float | None = None
    message_id: UUID | None = None
    reviewer_user: UUID | None = None
    reviewed_at: datetime | None = None
    review_note: str | None = None
    created_row_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AcceptProposalRequest(BaseModel):
    # Optional field overrides — user edited the proposal in the review form
    overrides: dict[str, Any] | None = None
    # Optional choice when ambiguity had multiple candidates
    disambiguation: dict[str, UUID] | None = None
    note: str | None = None


class RejectProposalRequest(BaseModel):
    reason: str | None = None


class AcceptProposalResponse(BaseModel):
    proposal: PendingProposalResponse
    created_row_id: UUID | None = None
    target_table: str | None = None


class BulkAcceptRequest(BaseModel):
    proposal_ids: list[UUID]
