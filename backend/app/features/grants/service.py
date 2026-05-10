from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

TABLE = "property_grants"
logger = get_logger("GRANTS")


def _flatten(rows: list[dict]) -> list[dict]:
    out: list[dict] = []
    for row in rows or []:
        prop = row.pop("properties", None) or {}
        row["property_title"] = prop.get("title")
        row["property_address"] = prop.get("address")
        out.append(row)
    return out


class GrantService:
    @staticmethod
    async def list_mine(user_id: UUID) -> list[dict]:
        client = get_supabase_client()
        resp = (
            client.table(TABLE)
            .select("*, properties(id, title, address)")
            .eq("user_id", str(user_id))
            .order("created_at")
            .execute()
        )
        return _flatten(resp.data)

    @staticmethod
    async def list_for_property(property_id: UUID) -> list[dict]:
        client = get_supabase_client()
        resp = (
            client.table(TABLE)
            .select("*, properties(id, title, address)")
            .eq("property_id", str(property_id))
            .order("created_at")
            .execute()
        )
        return _flatten(resp.data)

    @staticmethod
    async def list_for_user_admin(user_id: UUID) -> list[dict]:
        client = get_supabase_client()
        resp = (
            client.table(TABLE)
            .select("*, properties(id, title, address)")
            .eq("user_id", str(user_id))
            .order("created_at")
            .execute()
        )
        return _flatten(resp.data)

    @staticmethod
    async def create(payload: dict, granted_by: UUID) -> dict:
        client = get_supabase_client()
        row = {
            "user_id": str(payload["user_id"]),
            "property_id": str(payload["property_id"]),
            "tenant_id": str(payload["tenant_id"]),
            "view": payload.get("view") or "owner",
            "capabilities": payload.get("capabilities") or [],
            "granted_by": str(granted_by),
        }
        try:
            resp = client.table(TABLE).insert(row).execute()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Grant insert failed: {exc}") from exc
        return resp.data[0]

    @staticmethod
    async def update(grant_id: UUID, patch: dict) -> dict:
        client = get_supabase_client()
        data = {k: v for k, v in patch.items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update")
        resp = client.table(TABLE).update(data).eq("id", str(grant_id)).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Grant not found")
        return resp.data[0]

    @staticmethod
    async def delete(grant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TABLE).delete().eq("id", str(grant_id)).execute()
