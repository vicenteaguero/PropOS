from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role
from app.features.grants.schemas import (
    PropertyGrantCreate,
    PropertyGrantResponse,
    PropertyGrantUpdate,
)
from app.features.grants.service import GrantService

router = APIRouter(prefix="/grants", tags=["grants"])


@router.get("/me", response_model=list[PropertyGrantResponse])
async def list_my_grants(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return await GrantService.list_mine(UUID(current_user["id"]))


admin_router = APIRouter(prefix="/admin/grants", tags=["grants-admin"])


@admin_router.post(
    "",
    response_model=PropertyGrantResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def create_grant(
    payload: PropertyGrantCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await GrantService.create(payload.model_dump(), UUID(current_user["id"]))


@admin_router.patch(
    "/{grant_id}",
    response_model=PropertyGrantResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_grant(grant_id: UUID, payload: PropertyGrantUpdate) -> dict:
    return await GrantService.update(grant_id, payload.model_dump(exclude_unset=True))


@admin_router.delete(
    "/{grant_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def delete_grant(grant_id: UUID):
    await GrantService.delete(grant_id)
