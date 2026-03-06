from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

DOCUMENTS_TABLE = "documents"

logger = get_logger("DOCUMENTS")


class DocumentService:
    @staticmethod
    async def list_documents(
        tenant_id: UUID,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = (
            client.table(DOCUMENTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data

    @staticmethod
    async def get_document(document_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            document_id=str(document_id),
        )
        response = (
            client.table(DOCUMENTS_TABLE)
            .select("*")
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_document(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["entity_id"] = str(data["entity_id"])
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(DOCUMENTS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_document(
        document_id: UUID,
        payload: object,
        tenant_id: UUID,
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "entity_id" in data and data["entity_id"] is not None:
            data["entity_id"] = str(data["entity_id"])
        logger.info(
            "updating",
            event_type="write",
            document_id=str(document_id),
        )
        response = (
            client.table(DOCUMENTS_TABLE)
            .update(data)
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_document(document_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            document_id=str(document_id),
        )
        (
            client.table(DOCUMENTS_TABLE)
            .delete()
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
