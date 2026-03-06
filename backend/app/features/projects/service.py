from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.projects.constants import PROJECTS_TABLE

logger = get_logger("PROJECTS")


class ProjectService:
    @staticmethod
    async def list_projects(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = (
            client.table(PROJECTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data

    @staticmethod
    async def get_project(project_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            project_id=str(project_id),
        )
        response = (
            client.table(PROJECTS_TABLE)
            .select("*")
            .eq("id", str(project_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_project(payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["status"] = data["status"].value
        logger.info(
            "creating",
            event_type="write",
            tenant_id=str(tenant_id),
        )
        response = client.table(PROJECTS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_project(
        project_id: UUID, payload: object, tenant_id: UUID
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] is not None:
            data["status"] = data["status"].value
        logger.info(
            "updating",
            event_type="write",
            project_id=str(project_id),
        )
        response = (
            client.table(PROJECTS_TABLE)
            .update(data)
            .eq("id", str(project_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_project(project_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            project_id=str(project_id),
        )
        (
            client.table(PROJECTS_TABLE)
            .delete()
            .eq("id", str(project_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
