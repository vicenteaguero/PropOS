from __future__ import annotations

from uuid import UUID

from app.core.supabase.client import get_supabase_client

TAGS_TABLE = "tags"
TAGGINGS_TABLE = "taggings"


class TagService:
    @staticmethod
    async def list_tags(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return client.table(TAGS_TABLE).select("*").eq("tenant_id", str(tenant_id)).order("name").execute().data

    @staticmethod
    async def create_tag(payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        return client.table(TAGS_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_tag(tag_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        return (
            client.table(TAGS_TABLE)
            .update(data)
            .eq("id", str(tag_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_tag(tag_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TAGS_TABLE).delete().eq("id", str(tag_id)).eq("tenant_id", str(tenant_id)).execute()

    # Taggings
    @staticmethod
    async def list_taggings(tenant_id: UUID, target_table: str, target_row_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(TAGGINGS_TABLE)
            .select("*, tags(*)")
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", target_table)
            .eq("target_row_id", str(target_row_id))
            .execute()
            .data
        )

    @staticmethod
    async def add_tagging(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        data["tag_id"] = str(data["tag_id"])
        data["target_row_id"] = str(data["target_row_id"])
        return (
            client.table(TAGGINGS_TABLE).upsert(data, on_conflict="tag_id,target_table,target_row_id").execute().data[0]
        )

    @staticmethod
    async def remove_tagging(tagging_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TAGGINGS_TABLE).delete().eq("id", str(tagging_id)).eq("tenant_id", str(tenant_id)).execute()
