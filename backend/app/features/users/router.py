from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.users.schemas import (
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.features.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await UserService.get_me(UUID(current_user["id"]))


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_role("ADMIN"))])
async def list_users(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await UserService.list_users(tenant_id)


@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role("ADMIN"))])
async def get_user(
    user_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await UserService.get_user(user_id, tenant_id)


@router.post("", response_model=UserResponse, status_code=201, dependencies=[Depends(require_role("ADMIN"))])
async def create_user(
    payload: UserCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await UserService.create_user(payload, tenant_id)


@router.patch("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role("ADMIN"))])
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await UserService.update_user(user_id, payload, tenant_id)


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_role("ADMIN"))])
async def delete_user(
    user_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await UserService.delete_user(user_id, tenant_id)
