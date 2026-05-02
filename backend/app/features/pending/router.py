from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.pending.schemas import (
    AcceptProposalRequest,
    BulkAcceptRequest,
    PendingProposalResponse,
    RejectProposalRequest,
)
from app.features.pending.service import PendingService

router = APIRouter(prefix="/pending", tags=["pending"])


@router.get("", response_model=list[PendingProposalResponse])
async def list_pending(
    tenant_id: UUID = Depends(get_tenant_id),
    proposal_status: str | None = Query(default=None, alias="status"),
    kind: str | None = Query(default=None),
) -> list[dict]:
    return await PendingService.list_proposals(tenant_id, proposal_status, kind)


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
    )


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
