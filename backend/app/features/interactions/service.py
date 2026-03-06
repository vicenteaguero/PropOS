from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

INTERACTIONS_TABLE = "interactions"

logger = get_logger("INTERACTIONS")


class InteractionService:
    @staticmethod
    async def list_interactions(
        tenant_id: UUID,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = (
            client.table(INTERACTIONS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data

    @staticmethod
    async def get_interaction(interaction_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            interaction_id=str(interaction_id),
        )
        response = (
            client.table(INTERACTIONS_TABLE)
            .select("*")
            .eq("id", str(interaction_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_interaction(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        for uuid_field in ("user_id", "contact_id", "property_id"):
            if data.get(uuid_field) is not None:
                data[uuid_field] = str(data[uuid_field])
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(INTERACTIONS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_interaction(
        interaction_id: UUID,
        payload: object,
        tenant_id: UUID,
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        for uuid_field in ("user_id", "contact_id", "property_id"):
            if data.get(uuid_field) is not None:
                data[uuid_field] = str(data[uuid_field])
        logger.info(
            "updating",
            event_type="write",
            interaction_id=str(interaction_id),
        )
        response = (
            client.table(INTERACTIONS_TABLE)
            .update(data)
            .eq("id", str(interaction_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_interaction(interaction_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            interaction_id=str(interaction_id),
        )
        (
            client.table(INTERACTIONS_TABLE)
            .delete()
            .eq("id", str(interaction_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
