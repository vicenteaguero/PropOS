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

from app.core.supabase.auth_cache import invalidate_profile
from app.core.supabase.client import get_supabase_client


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


def _validate_membership(client, user_id: str, tenant_id: UUID) -> dict[str, Any]:
    resp = (
        client.table("tenant_memberships")
        .select("role, admin_scope")
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
    return resp.data[0]


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

    # Nothing to do when the request asks for the tenant the snapshot already
    # points at. This used to also require `requested is None`, which made it
    # dead code: the frontend attaches X-Tenant-Id to every request once a
    # workspace is chosen (shared/api/http.ts), so `requested` was never None
    # and every single API call re-validated the membership and rewrote
    # `profiles` — 15k writes in five days, the most expensive statement in the
    # database, and 65% of `audit_log` by way of the audit trigger.
    #
    # Trusting the snapshot here is not trusting the client. `profiles.tenant_id`
    # is only ever written by two paths (MembershipService.activate and the slow
    # path below) and both validate the membership first, so it is a
    # server-validated assertion. The header is client input, but it is only
    # honoured when it AGREES with that assertion.
    #
    # What this gives up is catching a revoked membership on the very next
    # request. That is paid for on the write side instead:
    # MembershipService._sync_profile_snapshot repoints the snapshot when a
    # membership is edited or removed, which forces the mismatch below.
    if target == current_snapshot:
        request.state.tenant_id = target
        return target

    # Validate membership + sync the profile snapshot (tenant_id/role/admin_scope)
    # directly. The activate_tenant() RPC can't be used here: it is SECURITY
    # DEFINER keyed on auth.uid(), which is null under the service-role client.
    membership = _validate_membership(client, user_id, target)
    client.table("profiles").update(
        {
            "tenant_id": str(target),
            "role": membership["role"],
            "admin_scope": membership.get("admin_scope") or [],
        }
    ).eq("id", user_id).execute()
    # The cached profile still carries the old tenant/role/scope.
    invalidate_profile(str(user_id))

    request.state.tenant_id = target
    return target
