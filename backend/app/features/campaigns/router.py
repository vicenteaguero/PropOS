from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.campaigns.schemas import (
    AdCreate,
    AdResponse,
    AdUpdate,
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
)
from app.features.campaigns.service import AdService, CampaignService

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(
    tenant_id: UUID = Depends(get_tenant_id),
    channel: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await CampaignService.list_campaigns(tenant_id, channel, status, q, limit)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await CampaignService.get_campaign(campaign_id, tenant_id)


@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await CampaignService.create_campaign(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    payload: CampaignUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await CampaignService.update_campaign(campaign_id, payload, tenant_id)


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
):
    await CampaignService.delete_campaign(campaign_id, tenant_id)


@router.get("/{campaign_id}/ads", response_model=list[AdResponse])
async def list_ads(
    campaign_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
) -> list[dict]:
    return await AdService.list_ads(campaign_id, tenant_id)


@router.post("/ads", response_model=AdResponse, status_code=201)
async def create_ad(
    payload: AdCreate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await AdService.create_ad(payload, tenant_id)


@router.patch("/ads/{ad_id}", response_model=AdResponse)
async def update_ad(
    ad_id: UUID, payload: AdUpdate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await AdService.update_ad(ad_id, payload, tenant_id)


@router.delete("/ads/{ad_id}", status_code=204)
async def delete_ad(ad_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await AdService.delete_ad(ad_id, tenant_id)
