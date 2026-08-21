from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

TABLE = "tenant_memberships"
PROFILES = "profiles"
logger = get_logger("MEMBERSHIPS")


def _sync_profile_snapshot(client, user_id: UUID) -> None:
    """Re-derive the `profiles` snapshot from the user's live memberships.

    `profiles` carries a denormalised copy of the active membership
    (`tenant_id`, `role`, `admin_scope`) because the RLS policies read it —
    `get_my_tenant_id()` falls back to it, which is what makes the browser's
    realtime subscription to `client_messages` tenant-safe.

    Until now nothing maintained that copy on the write side: it stayed correct
    only because `resolve_active_tenant` rewrote it on EVERY request, which is
    the cost this change removes. So the maintenance has to become deliberate.

    Deliberately re-derives from scratch rather than applying the patch that was
    just written. The caller knows which column it touched; it does not know
    whether that made the membership disappear from under the snapshot, and
    getting that reasoning wrong silently leaves a user pointing at a tenant
    they no longer belong to.
    """
    profile = client.table(PROFILES).select("tenant_id").eq("id", str(user_id)).maybe_single().execute()
    if not (profile and profile.data):
        return
    active_tenant = profile.data.get("tenant_id")

    memberships = (
        client.table(TABLE)
        .select("tenant_id, role, admin_scope")
        .eq("user_id", str(user_id))
        .eq("is_active", True)
        .order("created_at")
        .execute()
    ).data or []

    match = next((m for m in memberships if m["tenant_id"] == active_tenant), None)
    if match is None:
        # The snapshot points at a tenant the user is no longer active in.
        # Repointing is what closes the revocation hole: the next request whose
        # X-Tenant-Id still names the old tenant no longer matches the snapshot,
        # so `resolve_active_tenant` takes its slow path and 403s.
        match = memberships[0] if memberships else None

    if match is None:
        # `profiles.tenant_id` is NOT NULL, so a user with no memberships left
        # cannot be un-pointed. Deactivating the profile is the way to make the
        # stale snapshot inert — and `get_current_user` now honours that flag.
        client.table(PROFILES).update({"is_active": False}).eq("id", str(user_id)).execute()
        logger.info("profile deactivated: no active memberships", event_type="membership", user_id=str(user_id))
        return

    client.table(PROFILES).update(
        {
            "tenant_id": match["tenant_id"],
            "role": match["role"],
            "admin_scope": match.get("admin_scope") or [],
        }
    ).eq("id", str(user_id)).execute()


class MembershipService:
    @staticmethod
    async def list_for_user(user_id: UUID) -> list[dict]:
        client = get_supabase_client()
        resp = (
            client.table(TABLE)
            .select("*, tenants(id, name, slug)")
            .eq("user_id", str(user_id))
            .eq("is_active", True)
            .order("created_at")
            .execute()
        )
        out: list[dict] = []
        for row in resp.data or []:
            tenant = row.pop("tenants", None) or {}
            row["tenant_name"] = tenant.get("name")
            row["tenant_slug"] = tenant.get("slug")
            out.append(row)
        return out

    @staticmethod
    async def activate(user_id: UUID, tenant_id: UUID) -> dict:
        """Validate membership + call activate_tenant RPC + return updated profile."""
        client = get_supabase_client()
        check = (
            client.table(TABLE)
            .select("role, admin_scope")
            .eq("user_id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=403, detail=f"No active membership in tenant {tenant_id}")

        # Sync the profiles snapshot (tenant_id/role/admin_scope) for legacy RLS.
        # Done directly instead of via the activate_tenant() RPC: that function is
        # SECURITY DEFINER and keys off auth.uid(), which is null under the
        # service-role client, so it always raised "No active membership".
        m = check.data[0]
        client.table("profiles").update(
            {
                "tenant_id": str(tenant_id),
                "role": m["role"],
                "admin_scope": m.get("admin_scope") or [],
            }
        ).eq("id", str(user_id)).execute()

        profile = client.table("profiles").select("*").eq("id", str(user_id)).single().execute()
        return profile.data

    @staticmethod
    async def add(user_id: UUID, payload: dict) -> dict:
        client = get_supabase_client()
        row = {
            "user_id": str(user_id),
            "tenant_id": str(payload["tenant_id"]),
            "role": payload["role"],
            "admin_scope": payload.get("admin_scope") or [],
            "is_dev_admin": bool(payload.get("is_dev_admin", False)),
            "view": payload.get("view") or "agent",
        }
        try:
            resp = client.table(TABLE).insert(row).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Membership insert failed: {exc}") from exc
        return resp.data[0]

    @staticmethod
    async def update(user_id: UUID, tenant_id: UUID, patch: dict) -> dict:
        client = get_supabase_client()
        data = {k: v for k, v in patch.items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")
        resp = client.table(TABLE).update(data).eq("user_id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Membership not found")
        # Covers both a role/admin_scope edit and an is_active=False
        # deactivation. `is_dev_admin` and `view` live only on this table and
        # `get_user_profile` reads them from here, so they need no mirroring.
        _sync_profile_snapshot(client, user_id)
        return resp.data[0]

    @staticmethod
    async def delete(user_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TABLE).delete().eq("user_id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        # The one that actually revokes: without it the deleted membership's
        # tenant would survive in the snapshot, and `resolve_active_tenant`
        # trusts the snapshot.
        _sync_profile_snapshot(client, user_id)
