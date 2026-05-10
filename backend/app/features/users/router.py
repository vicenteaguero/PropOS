# TODO: producción — auditar endpoints, RLS, permisos antes de exponer en feature real.
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import get_current_user, get_tenant_id, require_dev_admin, require_role
from app.features.users.schemas import (
    AvatarUpdate,
    ImpersonateResponse,
    SetPasswordPayload,
    UserCreate,
    UserDetailResponse,
    UserEmailCreate,
    UserEmailResponse,
    UserInvite,
    UserResponse,
    UserUpdate,
)
from app.features.users.service import UserEmailService, UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict:
    return await UserService.get_me(UUID(current_user["id"]))


@router.patch("/me/avatar", response_model=UserResponse)
async def update_my_avatar(
    payload: AvatarUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await UserService.update_avatar(UUID(current_user["id"]), payload.avatar_url)


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_role("ADMIN"))])
async def list_users(
    tenant_id: UUID = Depends(get_tenant_id),
    role: str | None = Query(default=None),
    view: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list[dict]:
    return await UserService.list_users(tenant_id, role=role, view=view, search=search)


@router.get("/{user_id}", response_model=UserDetailResponse, dependencies=[Depends(require_role("ADMIN"))])
async def get_user(user_id: UUID) -> dict:
    return await UserService.get_user_detail(user_id)


@router.post("", response_model=UserResponse, status_code=201, dependencies=[Depends(require_role("ADMIN"))])
async def create_user(payload: UserCreate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await UserService.create_user(payload, tenant_id)


@router.post(
    "/invite",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def invite_user(payload: UserInvite, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await UserService.invite_user(payload, tenant_id)


@router.patch("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role("ADMIN"))])
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await UserService.update_user(user_id, payload, tenant_id)


@router.delete(
    "/{user_id}",
    status_code=204,
    dependencies=[Depends(require_dev_admin)],
)
async def delete_user(user_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await UserService.delete_user(user_id, tenant_id)


# ---------- security / lifecycle (admin) ----------


@router.post("/{user_id}/reset-password", dependencies=[Depends(require_role("ADMIN"))])
async def reset_password(user_id: UUID) -> dict:
    return await UserService.reset_password(user_id)


@router.post("/{user_id}/resend-invite", dependencies=[Depends(require_role("ADMIN"))])
async def resend_invite(user_id: UUID) -> dict:
    return await UserService.resend_invite(user_id)


@router.post("/{user_id}/set-password", dependencies=[Depends(require_dev_admin)])
async def set_password(user_id: UUID, payload: SetPasswordPayload) -> dict:
    return await UserService.set_password(user_id, payload.new_password)


@router.post("/{user_id}/disable", dependencies=[Depends(require_dev_admin)])
async def disable_user(user_id: UUID) -> dict:
    return await UserService.disable_user(user_id)


@router.post("/{user_id}/enable", dependencies=[Depends(require_dev_admin)])
async def enable_user(user_id: UUID) -> dict:
    return await UserService.enable_user(user_id)


@router.post(
    "/{user_id}/impersonate",
    response_model=ImpersonateResponse,
    dependencies=[Depends(require_dev_admin)],
)
async def impersonate(user_id: UUID) -> dict:
    return await UserService.impersonate(user_id)


# ---------- user_emails ----------


@router.get(
    "/{user_id}/emails",
    response_model=list[UserEmailResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def list_user_emails(user_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await UserEmailService.list_for_user(user_id, tenant_id)


@router.post(
    "/{user_id}/emails",
    response_model=UserEmailResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def add_user_email(user_id: UUID, payload: UserEmailCreate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await UserEmailService.add(user_id, tenant_id, payload)


@router.delete(
    "/{user_id}/emails/{email_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def delete_user_email(user_id: UUID, email_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await UserEmailService.delete(email_id, tenant_id)
