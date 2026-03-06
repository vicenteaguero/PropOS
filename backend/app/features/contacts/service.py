from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.contacts.constants import CONTACTS_TABLE

logger = get_logger("CONTACTS")


class ContactService:
    @staticmethod
    async def list_contacts(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data

    @staticmethod
    async def get_contact(contact_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            contact_id=str(contact_id),
        )
        response = (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_contact(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["type"] = data["type"].value
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(CONTACTS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_contact(
        contact_id: UUID, payload: object, tenant_id: UUID
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "type" in data and data["type"] is not None:
            data["type"] = data["type"].value
        logger.info(
            "updating",
            event_type="write",
            contact_id=str(contact_id),
        )
        response = (
            client.table(CONTACTS_TABLE)
            .update(data)
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_contact(contact_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            contact_id=str(contact_id),
        )
        (
            client.table(CONTACTS_TABLE)
            .delete()
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
