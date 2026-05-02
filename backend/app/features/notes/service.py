from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.core.supabase.client import get_supabase_client

NOTES_TABLE = "notes"


class NoteService:
    @staticmethod
    async def list_notes(
        tenant_id: UUID,
        target_table: str | None = None,
        target_row_id: UUID | None = None,
        limit: int = 100,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(NOTES_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if target_table:
            builder = builder.eq("target_table", target_table)
        if target_row_id:
            builder = builder.eq("target_row_id", str(target_row_id))
        return builder.execute().data

    @staticmethod
    async def create_note(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        if data.get("target_row_id") is not None:
            data["target_row_id"] = str(data["target_row_id"])
        return client.table(NOTES_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_note(note_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        return (
            client.table(NOTES_TABLE)
            .update(data)
            .eq("id", str(note_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_note(note_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(NOTES_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(note_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
