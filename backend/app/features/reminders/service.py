from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.core.supabase.client import get_supabase_client

REMINDERS_TABLE = "reminders"


class ReminderService:
    @staticmethod
    async def list_reminders(
        tenant_id: UUID, target_table: str | None = None, target_row_id: UUID | None = None
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(REMINDERS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("remind_at", desc=False)
        )
        if target_table:
            builder = builder.eq("target_table", target_table)
        if target_row_id is not None:
            builder = builder.eq("target_row_id", str(target_row_id))
        return builder.execute().data

    @staticmethod
    async def create_reminder(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = {
            "tenant_id": str(tenant_id),
            "target_table": payload.target_table.value,
            "target_row_id": str(payload.target_row_id),
            "user_id": str(payload.user_id or created_by),
            "remind_at": payload.remind_at.isoformat(),
            "message": payload.message,
            "url": payload.url,
            "created_by": str(created_by),
        }
        return client.table(REMINDERS_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def delete_reminder(reminder_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(REMINDERS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq(
            "id", str(reminder_id)
        ).eq("tenant_id", str(tenant_id)).execute()
