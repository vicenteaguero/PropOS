from __future__ import annotations

from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

CONTACTS_TABLE = "contacts"

logger = get_logger("CONTACTS")


class ContactService:
    @staticmethod
    async def list_contacts(
        tenant_id: UUID,
        query: str | None = None,
        include_drafts: bool = True,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info("listing", event_type="query", tenant_id=str(tenant_id))
        builder = (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
        )
        if not include_drafts:
            builder = builder.eq("is_draft", False)
        if query:
            builder = builder.ilike("full_name", f"%{query}%")
        return builder.execute().data

    @staticmethod
    async def get_contact(contact_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
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
    async def create_contact(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["type"] = data["type"].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        if data.get("email") is not None:
            data["email"] = str(data["email"])
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        response = client.table(CONTACTS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_contact(
        contact_id: UUID, payload, tenant_id: UUID
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "type" in data and data["type"] is not None:
            data["type"] = data["type"].value
        if "email" in data and data["email"] is not None:
            data["email"] = str(data["email"])
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
        (
            client.table(CONTACTS_TABLE)
            .delete()
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
