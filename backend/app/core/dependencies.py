from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.logging.logger import get_logger
from app.core.supabase.auth import get_user_profile, verify_token
from app.core.tenant import resolve_active_tenant

logger = get_logger("DEPS")

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

    # `is False`, not falsy: the column defaults to true and is nullable, so an
    # older row with NULL must keep working. Only an explicit deactivation
    # rejects.
    #
    # UserService.deactivate has been writing this flag for months and nothing
    # ever read it, so "deactivated" users kept full API access. It is also
    # what makes a profile whose last membership was removed inert — see
    # MembershipService._sync_profile_snapshot, which cannot null the NOT NULL
    # `tenant_id` and deactivates the profile instead.
    if profile.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
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


def scope_allows(admin_scope: list[str] | None, scope: str) -> bool:
    """An empty `admin_scope` is full admin; otherwise it is a whitelist.

    The rule itself, separated from the FastAPI dependency, because it is also
    needed off the request path — `channels/router.py` decides whether a WhatsApp
    number belongs to a broker entitled to Propo, and had its own copy of this
    convention. Two copies of an authorization rule is one too many.
    """
    return not admin_scope or scope in admin_scope


def require_scope(scope: str) -> Callable:
    """Allow when user has empty admin_scope (full admin) or scope is whitelisted."""

    async def scope_checker(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        if not scope_allows(current_user.get("admin_scope"), scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_MESSAGE,
            )
        return current_user

    return scope_checker


def require_feature(key: str) -> Callable:
    """Refuse when the tenant has the feature locked or hidden.

    The second half of the visibility rule, orthogonal to `require_scope`: the
    scope says who may use a feature, this says whether the feature is open at
    all for this brokerage. Both are evaluated; either can refuse.

    423 rather than 403 on purpose. A 403 means "not you", and the frontend
    treats it as a permission problem worth telling the user about. This is "not
    yet, for anybody here", and the note travels with it so the screen can say
    why. `wip` passes -- the point of a work-in-progress feature is that it gets
    exercised.
    """

    async def feature_checker(
        current_user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        from app.core.features import BLOCKING_STATES, resolve_states

        # Fails OPEN. This dependency hangs off most routers, so a database
        # hiccup while reading a configuration table would otherwise refuse
        # every request in the product -- turning a table nobody edits into a
        # single point of failure for the whole API. A feature that stays
        # reachable during an outage is the lesser wrong.
        try:
            entry = resolve_states(current_user["tenant_id"]).get(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "feature_state_unavailable",
                event_type="error",
                feature=key,
                error=str(exc),
            )
            return current_user

        if entry and entry["state"] in {s.value for s in BLOCKING_STATES}:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=entry.get("note") or "Esta función no está disponible por ahora.",
            )
        return current_user

    return feature_checker


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
