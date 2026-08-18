from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

PROPERTIES_TABLE = "properties"

logger = get_logger("PROPERTIES")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        elif hasattr(v, "value"):
            out[k] = v.value
        else:
            out[k] = v
    return out


class PropertyService:
    @staticmethod
    async def list_properties(
        tenant_id: UUID,
        query: str | None = None,
        include_drafts: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info("listing", event_type="query", tenant_id=str(tenant_id))
        # Always bounded: an unlimited select is truncated at db-max-rows with
        # no error, so the caller can't tell a short page from the whole table.
        builder = (
            client.table(PROPERTIES_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if not include_drafts:
            builder = builder.eq("is_draft", False)
        if query:
            builder = builder.ilike("title", f"%{query}%")
        return builder.execute().data

    @staticmethod
    async def get_property(property_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        response = (
            client.table(PROPERTIES_TABLE)
            .select("*")
            .eq("id", str(property_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_property(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _serialize(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        response = client.table(PROPERTIES_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_property(property_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _serialize(payload.model_dump(exclude_unset=True))
        response = (
            client.table(PROPERTIES_TABLE)
            .update(data)
            .eq("id", str(property_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_property(property_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (client.table(PROPERTIES_TABLE).delete().eq("id", str(property_id)).eq("tenant_id", str(tenant_id)).execute())
