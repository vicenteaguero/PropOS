from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_role
from app.features.memberships.schemas import (
    ActivateTenantRequest,
    TenantMembershipCreate,
    TenantMembershipResponse,
    TenantMembershipUpdate,
)
from app.features.memberships.service import MembershipService

router = APIRouter(prefix="/memberships", tags=["memberships"])


@router.get("/me", response_model=list[TenantMembershipResponse])
async def list_my_memberships(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    return await MembershipService.list_for_user(UUID(current_user["id"]))


@router.post("/activate")
async def activate_tenant(
    payload: ActivateTenantRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await MembershipService.activate(UUID(current_user["id"]), payload.tenant_id)


admin_router = APIRouter(prefix="/admin/users/{user_id}/memberships", tags=["memberships-admin"])


@admin_router.post(
    "",
    response_model=TenantMembershipResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def add_membership(user_id: UUID, payload: TenantMembershipCreate) -> dict:
    return await MembershipService.add(user_id, payload.model_dump())


@admin_router.patch(
    "/{tenant_id}",
    response_model=TenantMembershipResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_membership(user_id: UUID, tenant_id: UUID, payload: TenantMembershipUpdate) -> dict:
    return await MembershipService.update(user_id, tenant_id, payload.model_dump(exclude_unset=True))


@admin_router.delete(
    "/{tenant_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def delete_membership(user_id: UUID, tenant_id: UUID):
    await MembershipService.delete(user_id, tenant_id)
