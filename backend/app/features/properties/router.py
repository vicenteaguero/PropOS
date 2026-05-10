from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_dev_admin, require_role
from app.features.grants.schemas import PropertyGrantResponse
from app.features.grants.service import GrantService
from app.features.properties.schemas import (
    PropertyCreate,
    PropertyResponse,
    PropertyUpdate,
)
from app.features.properties.service import PropertyService

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=list[PropertyResponse])
async def list_properties(
    tenant_id: UUID = Depends(get_tenant_id),
    q: str | None = Query(default=None),
    include_drafts: bool = Query(default=True),
) -> list[dict]:
    return await PropertyService.list_properties(tenant_id, q, include_drafts)


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PropertyService.get_property(property_id, tenant_id)


@router.post("", response_model=PropertyResponse, status_code=201)
async def create_property(
    payload: PropertyCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PropertyService.create_property(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PropertyService.update_property(property_id, payload, tenant_id)


@router.delete("/{property_id}", status_code=204, dependencies=[Depends(require_dev_admin)])
async def delete_property(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await PropertyService.delete_property(property_id, tenant_id)


@router.get(
    "/{property_id}/grants",
    response_model=list[PropertyGrantResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def list_property_grants(property_id: UUID) -> list[dict]:
    return await GrantService.list_for_property(property_id)
