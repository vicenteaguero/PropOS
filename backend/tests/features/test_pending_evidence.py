"""The evidence trail has to survive the response model.

`pending_proposals` gained `evidence` and `review_reason`, and the service
selects `*` — but FastAPI serializes through `PendingProposalResponse`, so a
column the model does not declare is silently dropped on the way out. The
symptom is indistinguishable from "the AI recorded no evidence", which is
exactly the thing the reviewer needs to be able to tell apart.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.features.pending.schemas import PendingProposalResponse, RejectReason

ROW = {
    "id": uuid4(),
    "tenant_id": uuid4(),
    "agent_session_id": uuid4(),
    "proposed_by_user": uuid4(),
    "kind": "propose_create_person",
    "payload": {"full_name": "Pedro Soto"},
    "status": "pending",
    "created_at": datetime.now(UTC),
    "updated_at": datetime.now(UTC),
}


def test_evidence_survives_serialization() -> None:
    evidence = {
        "quote": "anota a Pedro Soto, +56 9 1234 5678",
        "source": "whatsapp",
        "conversation_id": str(uuid4()),
    }
    dumped = PendingProposalResponse(**ROW, evidence=evidence).model_dump()
    assert dumped["evidence"]["quote"] == evidence["quote"]
    assert dumped["evidence"]["source"] == "whatsapp"


def test_rejection_reason_survives_serialization() -> None:
    dumped = PendingProposalResponse(**ROW, review_reason=RejectReason.ENTIDAD_EQUIVOCADA).model_dump()
    assert dumped["review_reason"] == RejectReason.ENTIDAD_EQUIVOCADA


def test_both_default_to_none_for_older_proposals() -> None:
    """Every proposal created before this existed has neither, and that must
    deserialize rather than 500 the whole queue."""
    dumped = PendingProposalResponse(**ROW).model_dump()
    assert dumped["evidence"] is None
    assert dumped["review_reason"] is None
