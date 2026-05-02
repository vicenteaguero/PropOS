from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.places.schemas import PlaceCreate, PlaceResponse, PlaceUpdate
from app.features.places.service import PlaceService

router = APIRouter(prefix="/places", tags=["places"])


@router.get("", response_model=list[PlaceResponse])
async def list_places(
    tenant_id: UUID = Depends(get_tenant_id),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await PlaceService.list_places(tenant_id, q, limit)


@router.get("/{place_id}", response_model=PlaceResponse)
async def get_place(place_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await PlaceService.get_place(place_id, tenant_id)


@router.post("", response_model=PlaceResponse, status_code=201)
async def create_place(
    payload: PlaceCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PlaceService.create_place(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{place_id}", response_model=PlaceResponse)
async def update_place(place_id: UUID, payload: PlaceUpdate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await PlaceService.update_place(place_id, payload, tenant_id)


@router.delete("/{place_id}", status_code=204)
async def delete_place(place_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await PlaceService.delete_place(place_id, tenant_id)
