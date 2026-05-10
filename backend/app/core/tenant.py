"""Active-tenant resolution for multi-tenant requests.

Frontend sends ``X-Tenant-Id`` header; backend validates the user has an
active membership in that tenant and calls the ``activate_tenant`` RPC,
which updates the profile snapshot fields read by existing RLS policies.

If the requested tenant matches the user's current snapshot, no RPC call
is made (avoid an UPDATE per request).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, status

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("TENANT")


def _read_header_tenant(request: Request) -> UUID | None:
    raw = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-Id")
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Tenant-Id header (must be UUID)",
        ) from exc


def _default_tenant(client, user_id: str) -> UUID | None:
    """Pick the first active membership as default tenant."""
    resp = (
        client.table("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None
    return UUID(resp.data[0]["tenant_id"])


def _validate_membership(client, user_id: str, tenant_id: UUID) -> None:
    resp = (
        client.table("tenant_memberships")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("tenant_id", str(tenant_id))
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No active membership in tenant {tenant_id}",
        )


def resolve_active_tenant(
    request: Request,
    current_user: dict[str, Any],
) -> UUID:
    """Determine + activate the tenant for this request.

    Returns the active tenant UUID. Side-effect: profile snapshot fields
    are synced to the active membership when tenant changes.
    """
    client = get_supabase_client()
    user_id = current_user["id"]
    current_snapshot = current_user.get("tenant_id")
    if current_snapshot:
        current_snapshot = UUID(current_snapshot)

    requested = _read_header_tenant(request)
    target = requested or current_snapshot or _default_tenant(client, user_id)

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant memberships for user",
        )

    # Skip RPC if snapshot already matches and no header override.
    if requested is None and target == current_snapshot:
        return target

    _validate_membership(client, user_id, target)
    try:
        client.rpc("activate_tenant", {"p_tenant": str(target)}).execute()
    except Exception as exc:
        logger.error(
            "activate_tenant_failed",
            event_type="error",
            user_id=user_id,
            tenant_id=str(target),
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Failed to activate tenant",
        ) from exc

    request.state.tenant_id = target
    return target
