from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.properties.constants import PROPERTIES_TABLE

logger = get_logger("PROPERTIES")


class PropertyService:
    @staticmethod
    async def list_properties(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = (
            client.table(PROPERTIES_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data

    @staticmethod
    async def get_property(property_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            property_id=str(property_id),
        )
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
    async def create_property(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["status"] = data["status"].value
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(PROPERTIES_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_property(
        property_id: UUID, payload: object, tenant_id: UUID
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] is not None:
            data["status"] = data["status"].value
        logger.info(
            "updating",
            event_type="write",
            property_id=str(property_id),
        )
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
        logger.info(
            "deleting",
            event_type="delete",
            property_id=str(property_id),
        )
        (
            client.table(PROPERTIES_TABLE)
            .delete()
            .eq("id", str(property_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
