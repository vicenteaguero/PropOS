from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.dependencies import (
    get_current_user,
    get_tenant_id,
    require_feature,
    require_role,
    require_scope,
)
from app.features.pending.overrides import OverrideError
from app.features.pending.undo import UndoError
from app.features.pending.schemas import (
    AcceptProposalRequest,
    BulkAcceptRequest,
    PendingProposalResponse,
    RejectProposalRequest,
)
from app.features.pending.service import PendingService

# Reviewing/accepting agent proposals is limited to the roles that can act on
# the broker's behalf. LANDOWNER/BUYER have no pending queue.
router = APIRouter(
    prefix="/pending",
    tags=["pending"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT", "CONTENT")),
        Depends(require_scope("pendientes")),
        Depends(require_feature("pendientes")),
    ],
)


@router.get("", response_model=list[PendingProposalResponse])
async def list_pending(
    tenant_id: UUID = Depends(get_tenant_id),
    proposal_status: str | None = Query(default=None, alias="status"),
    kind: str | None = Query(default=None),
    # See PendingService.list_proposals. Only meaningful for `status=pending`.
    bucket: str = Query(default="all", pattern="^(all|urgent|recent|old)$"),
    limit: int = Query(default=50, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await PendingService.list_proposals(
        tenant_id, proposal_status, kind, bucket=bucket, limit=limit, offset=offset
    )


@router.get("/count")
async def count_pending(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, int]:
    """How many are waiting, uncapped.

    The sidebar badge used to be `list().length`, which was honest only while
    the list was unbounded. With a page size it would have silently become "at
    most 50" — a badge that stops counting is worse than no badge.
    """
    return {"pending": await PendingService.count_pending(tenant_id)}


@router.get("/{proposal_id}", response_model=PendingProposalResponse)
async def get_pending(
    proposal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PendingService.get_proposal(proposal_id, tenant_id)


@router.post("/{proposal_id}/accept", response_model=PendingProposalResponse)
async def accept_pending(
    proposal_id: UUID,
    payload: AcceptProposalRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    try:
        return await PendingService.accept_proposal(
            proposal_id=proposal_id,
            tenant_id=tenant_id,
            reviewer_user=UUID(current_user["id"]),
            overrides=payload.overrides,
            disambiguation=payload.disambiguation,
            note=payload.note,
        )
    except NotImplementedError as exc:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc)) from exc
    # Before the ValueError clause: OverrideError subclasses it, and a bad
    # correction is the caller's mistake (422), not a conflicting state (409).
    except OverrideError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/{proposal_id}/reject", response_model=PendingProposalResponse)
async def reject_pending(
    proposal_id: UUID,
    payload: RejectProposalRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PendingService.reject_proposal(
        proposal_id=proposal_id,
        tenant_id=tenant_id,
        reviewer_user=UUID(current_user["id"]),
        reason=payload.reason,
        review_reason=payload.review_reason.value if payload.review_reason else None,
    )


@router.post("/{proposal_id}/undo", response_model=PendingProposalResponse)
async def undo_pending(
    proposal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Reverse an accepted proposal and return it to the queue.

    Destructive: it removes the record the accept created, or restores the one
    it modified. `undo.py` refuses when a human has touched that record since.
    """
    try:
        return await PendingService.undo_proposal(proposal_id, tenant_id, UUID(current_user["id"]))
    except UndoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/{proposal_id}/reopen", response_model=PendingProposalResponse)
async def reopen_pending(
    proposal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    """Put a rejected proposal back in the queue. Nothing was written, so there
    is nothing to reverse — only the review to clear."""
    try:
        return await PendingService.reopen_proposal(proposal_id, tenant_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/bulk-accept", response_model=list[PendingProposalResponse])
async def bulk_accept(
    payload: BulkAcceptRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    results: list[dict] = []
    for pid in payload.proposal_ids:
        try:
            results.append(
                await PendingService.accept_proposal(
                    proposal_id=pid,
                    tenant_id=tenant_id,
                    reviewer_user=UUID(current_user["id"]),
                )
            )
        except (NotImplementedError, ValueError):
            continue
    return results
