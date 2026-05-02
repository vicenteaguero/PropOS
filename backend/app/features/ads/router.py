from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_tenant_id
from app.features.campaigns.schemas import AdCreate, AdResponse, AdUpdate
from app.features.campaigns.service import AdService

router = APIRouter(prefix="/ads", tags=["ads"])


@router.get("", response_model=list[AdResponse])
async def list_ads(
    tenant_id: UUID = Depends(get_tenant_id),
    campaign_id: UUID | None = Query(default=None),
) -> list[dict]:
    return await AdService.list_ads(campaign_id, tenant_id)


@router.post("", response_model=AdResponse, status_code=201)
async def create_ad(payload: AdCreate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await AdService.create_ad(payload, tenant_id)


@router.patch("/{ad_id}", response_model=AdResponse)
async def update_ad(
    ad_id: UUID,
    payload: AdUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await AdService.update_ad(ad_id, payload, tenant_id)


@router.delete("/{ad_id}", status_code=204)
async def delete_ad(ad_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await AdService.delete_ad(ad_id, tenant_id)
