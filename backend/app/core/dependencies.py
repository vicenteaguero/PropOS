from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase.auth import get_user_profile, verify_token
from app.core.tenant import resolve_active_tenant

bearer_scheme = HTTPBearer()

UNAUTHORIZED_MESSAGE = "Invalid or expired token"
FORBIDDEN_MESSAGE = "Insufficient permissions"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict[str, Any]:
    token = credentials.credentials
    try:
        user = verify_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHORIZED_MESSAGE,
        ) from exc

    profile = get_user_profile(str(user.id))
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHORIZED_MESSAGE,
        )

    return {
        "id": profile["id"],
        "role": profile["role"],
        "tenant_id": profile["tenant_id"],
        "full_name": profile.get("full_name"),
        "admin_scope": profile.get("admin_scope") or [],
        "is_dev_admin": bool(profile.get("is_dev_admin")),
        "view": profile.get("view") or "agent",
    }


def require_role(*roles: str) -> Callable:
    async def role_checker(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_MESSAGE,
            )
        return current_user

    return role_checker


def require_scope(scope: str) -> Callable:
    """Allow when user has empty admin_scope (full admin) or scope is whitelisted."""

    async def scope_checker(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        admin_scope: list[str] = current_user.get("admin_scope") or []
        if admin_scope and scope not in admin_scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_MESSAGE,
            )
        return current_user

    return scope_checker


async def require_dev_admin(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Gate destructive operations: only ADMIN with is_dev_admin=true."""
    if current_user.get("role") != "ADMIN" or not current_user.get("is_dev_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev admin required",
        )
    return current_user


async def get_tenant_id(
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> UUID:
    """Resolve the active tenant for this request.

    Reads X-Tenant-Id header → validates membership → calls activate_tenant
    RPC if it differs from the user's current snapshot. Existing RLS policies
    keep working off `profiles.*` (kept in sync by the RPC).
    """
    return resolve_active_tenant(request, current_user)
