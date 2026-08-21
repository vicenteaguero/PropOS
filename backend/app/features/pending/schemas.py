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


class RejectReason(str, Enum):
    """Why a proposal was turned down.

    A taxonomy, not just free text, because a rejection is the cheapest signal
    there is about where the AI is wrong and free text cannot be counted. Small
    on purpose; the detail goes in `reason`.
    """

    DATO_INCORRECTO = "dato_incorrecto"
    ENTIDAD_EQUIVOCADA = "entidad_equivocada"
    NO_CORRESPONDE = "no_corresponde"
    DUPLICADO = "duplicado"
    OTRO = "otro"


class PendingProposalResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    agent_session_id: UUID
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
    #: Why the proposal was rejected, from a fixed taxonomy.
    review_reason: RejectReason | None = None
    #: What the human actually said that produced this proposal:
    #: {"quote", "source", "conversation_id", "client_message_id", "transcript_id"}.
    #: Absent on every proposal created before the evidence trail existed.
    evidence: dict[str, Any] | None = None
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
    #: Free-text detail, stored in `review_note`.
    reason: str | None = None
    review_reason: RejectReason | None = None


class AcceptProposalResponse(BaseModel):
    proposal: PendingProposalResponse
    created_row_id: UUID | None = None
    target_table: str | None = None


class BulkAcceptRequest(BaseModel):
    proposal_ids: list[UUID]
