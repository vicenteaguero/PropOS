from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.internal_areas.schemas import (
    InternalAreaCreate,
    InternalAreaResponse,
    InternalAreaUpdate,
)
from app.features.internal_areas.service import InternalAreaService

router = APIRouter(prefix="/internal-areas", tags=["internal-areas"])


@router.get("", response_model=list[InternalAreaResponse])
async def list_areas(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await InternalAreaService.list_areas(tenant_id)


@router.get("/{area_id}", response_model=InternalAreaResponse)
async def get_area(
    area_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InternalAreaService.get_area(area_id, tenant_id)


@router.post(
    "",
    response_model=InternalAreaResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def create_area(
    payload: InternalAreaCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await InternalAreaService.create_area(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch(
    "/{area_id}",
    response_model=InternalAreaResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_area(
    area_id: UUID,
    payload: InternalAreaUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InternalAreaService.update_area(area_id, payload, tenant_id)


@router.delete(
    "/{area_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def delete_area(
    area_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await InternalAreaService.delete_area(area_id, tenant_id)
