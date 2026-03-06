from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase.auth import get_user_profile, verify_token

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


async def get_tenant_id(
    request: Request,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> UUID:
    tenant_id = UUID(current_user["tenant_id"])
    request.state.tenant_id = tenant_id
    return tenant_id
