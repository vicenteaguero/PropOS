from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id
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
) -> list[dict]:
    return await PropertyService.list_properties(tenant_id)


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
) -> dict:
    return await PropertyService.create_property(payload, tenant_id)


@router.patch("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PropertyService.update_property(property_id, payload, tenant_id)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await PropertyService.delete_property(property_id, tenant_id)
