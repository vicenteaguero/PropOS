from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

TABLE = "tenant_memberships"
logger = get_logger("MEMBERSHIPS")


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
            .select("user_id")
            .eq("user_id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=403, detail=f"No active membership in tenant {tenant_id}")

        try:
            client.rpc("activate_tenant", {"p_tenant": str(tenant_id)}).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"activate_tenant failed: {exc}") from exc

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
        return resp.data[0]

    @staticmethod
    async def delete(user_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TABLE).delete().eq("user_id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
