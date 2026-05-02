from __future__ import annotations

from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

PROPERTIES_TABLE = "properties"

logger = get_logger("PROPERTIES")


class PropertyService:
    @staticmethod
    async def list_properties(
        tenant_id: UUID,
        query: str | None = None,
        include_drafts: bool = True,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info("listing", event_type="query", tenant_id=str(tenant_id))
        builder = (
            client.table(PROPERTIES_TABLE).select("*").eq("tenant_id", str(tenant_id)).order("created_at", desc=True)
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
        data = payload.model_dump()
        data["status"] = data["status"].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        response = client.table(PROPERTIES_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_property(property_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] is not None:
            data["status"] = data["status"].value
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
