from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

PLACES_TABLE = "places"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


class PlaceService:
    @staticmethod
    async def list_places(
        tenant_id: UUID, q: str | None = None, limit: int = 100
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(PLACES_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("name")
            .limit(limit)
        )
        if q:
            builder = builder.ilike("name", f"%{q}%")
        return builder.execute().data

    @staticmethod
    async def get_place(place_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(PLACES_TABLE)
            .select("*")
            .eq("id", str(place_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_place(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(PLACES_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_place(place_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        return (
            client.table(PLACES_TABLE)
            .update(data)
            .eq("id", str(place_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_place(place_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(PLACES_TABLE).update(
            {"deleted_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(place_id)).eq("tenant_id", str(tenant_id)).execute()
