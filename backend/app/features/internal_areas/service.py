from __future__ import annotations

from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

AREAS_TABLE = "internal_areas"

logger = get_logger("AREAS")


class InternalAreaService:
    @staticmethod
    async def list_areas(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        response = (
            client.table(AREAS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("name")
            .execute()
        )
        return response.data

    @staticmethod
    async def get_area(area_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        response = (
            client.table(AREAS_TABLE)
            .select("*")
            .eq("id", str(area_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_area(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        response = client.table(AREAS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_area(area_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        response = (
            client.table(AREAS_TABLE)
            .update(data)
            .eq("id", str(area_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_area(area_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (
            client.table(AREAS_TABLE)
            .delete()
            .eq("id", str(area_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
