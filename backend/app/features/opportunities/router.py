from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_feature, require_role, require_scope
from app.features.opportunities.schemas import (
    OpportunityCreate,
    OpportunityResponse,
    OpportunityUpdate,
    StageHistoryResponse,
)
from app.features.opportunities.detail import build_detail
from app.features.opportunities.service import OpportunityService

router = APIRouter(
    prefix="/opportunities",
    tags=["opportunities"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("crm")),
        Depends(require_feature("crm")),
    ],
)


@router.get("", response_model=list[OpportunityResponse])
async def list_opportunities(
    tenant_id: UUID = Depends(get_tenant_id),
    status: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    person_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await OpportunityService.list_opportunities(tenant_id, status, stage, person_id, property_id, limit, offset)


@router.get("/{opp_id}", response_model=OpportunityResponse)
async def get_opportunity(opp_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await OpportunityService.get_opportunity(opp_id, tenant_id)


@router.get("/{opp_id}/detail")
async def get_detail(
    opp_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    """The deal, its people, its properties, its history and its file.

    One call because a deal page that fired six is a deal page that renders in
    six stages. The reads run concurrently off the event loop.
    """
    return await build_detail(tenant_id, opp_id)


@router.get("/{opp_id}/history", response_model=list[StageHistoryResponse])
async def get_history(opp_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await OpportunityService.get_history(opp_id, tenant_id)


@router.post("", response_model=OpportunityResponse, status_code=201)
async def create_opportunity(
    payload: OpportunityCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await OpportunityService.create_opportunity(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{opp_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opp_id: UUID,
    payload: OpportunityUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await OpportunityService.update_opportunity(opp_id, payload, tenant_id)


@router.delete("/{opp_id}", status_code=204)
async def delete_opportunity(opp_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await OpportunityService.delete_opportunity(opp_id, tenant_id)
