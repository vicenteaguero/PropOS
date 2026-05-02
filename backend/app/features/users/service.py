from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

PROFILES_TABLE = "profiles"

logger = get_logger("USERS")


class UserService:
    @staticmethod
    async def list_users(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = client.table(PROFILES_TABLE).select("*").eq("tenant_id", str(tenant_id)).execute()
        return response.data

    @staticmethod
    async def get_user(user_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            user_id=str(user_id),
        )
        response = (
            client.table(PROFILES_TABLE)
            .select("*")
            .eq("id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def get_me(user_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching_self",
            event_type="query",
            user_id=str(user_id),
        )
        response = client.table(PROFILES_TABLE).select("*").eq("id", str(user_id)).single().execute()
        return response.data

    @staticmethod
    async def create_user(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["role"] = data["role"].value
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(PROFILES_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_user(user_id: UUID, payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "role" in data and data["role"] is not None:
            data["role"] = data["role"].value
        logger.info(
            "updating",
            event_type="write",
            user_id=str(user_id),
        )
        response = (
            client.table(PROFILES_TABLE).update(data).eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_user(user_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            user_id=str(user_id),
        )
        (client.table(PROFILES_TABLE).delete().eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute())
