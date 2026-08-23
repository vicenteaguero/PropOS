from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.db import run_blocking
from app.core.supabase.client import get_supabase_client

EVENTS_TABLE = "events"
logger = get_logger("EVENTS")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        elif hasattr(v, "value"):
            out[k] = v.value
        else:
            out[k] = v
    return out


class EventService:
    @staticmethod
    async def list_events(
        tenant_id: UUID,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        assignee_user: UUID | None = None,
        kind: str | None = None,
        limit: int = 500,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(EVENTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("starts_at", desc=False)
            .limit(limit)
        )
        if date_from:
            builder = builder.gte("starts_at", date_from.isoformat())
        if date_to:
            builder = builder.lte("starts_at", date_to.isoformat())
        if assignee_user is not None:
            builder = builder.eq("assignee_user", str(assignee_user))
        if kind:
            builder = builder.eq("kind", kind)
        return builder.execute().data

    @staticmethod
    async def get_event(event_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(EVENTS_TABLE)
            .select("*")
            .eq("id", str(event_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_event(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        remind_at = data.pop("remind_at", None)
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        data = _serialize(data)
        row = client.table(EVENTS_TABLE).insert(data).execute().data[0]

        if remind_at:
            client.table("reminders").insert(
                {
                    "tenant_id": str(tenant_id),
                    "target_table": "events",
                    "target_row_id": row["id"],
                    "user_id": str(created_by),
                    "remind_at": remind_at.isoformat() if hasattr(remind_at, "isoformat") else remind_at,
                    "message": row["title"],
                    "created_by": str(created_by),
                }
            ).execute()

        logger.info("created", event_type="write", event_id=row["id"])
        return row

    @staticmethod
    async def update_event(event_id: UUID, payload, tenant_id: UUID, user_id: UUID | None = None) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        # Reminder fields are not columns on `events`.
        remind_at = data.pop("remind_at", None)
        clear_reminder = data.pop("clear_reminder", False)
        data = _serialize(data)

        row = (
            client.table(EVENTS_TABLE)
            .update(data)
            .eq("id", str(event_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
            if data
            else await EventService.get_event(event_id, tenant_id)
        )

        # Moving an event used to leave its reminder ringing on the old day,
        # because `EventUpdate` had no way to say anything about reminders at
        # all. Replace rather than add: a second row for the same event would
        # notify twice.
        if clear_reminder or remind_at:
            EventService._replace_reminder(
                client,
                tenant_id=tenant_id,
                event_id=event_id,
                user_id=user_id,
                remind_at=None if clear_reminder else remind_at,
                title=row.get("title"),
            )
        return row

    @staticmethod
    def _replace_reminder(client, *, tenant_id, event_id, user_id, remind_at, title) -> None:
        query = (
            client.table("reminders")
            .delete()
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", "events")
            .eq("target_row_id", str(event_id))
        )
        if user_id:
            query = query.eq("user_id", str(user_id))
        query.execute()
        if not remind_at or not user_id:
            return
        client.table("reminders").insert(
            {
                "tenant_id": str(tenant_id),
                "target_table": "events",
                "target_row_id": str(event_id),
                "user_id": str(user_id),
                "remind_at": remind_at.isoformat() if hasattr(remind_at, "isoformat") else remind_at,
                "message": title,
                "created_by": str(user_id),
            }
        ).execute()

    @staticmethod
    async def delete_event(event_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(EVENTS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(event_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()

    @staticmethod
    async def calendar_feed(
        tenant_id: UUID, date_from: datetime | None = None, date_to: datetime | None = None
    ) -> list[dict]:
        # Off the event loop: the Supabase client is synchronous, so an
        # inline round trip holds the whole worker for its duration.
        def _read() -> list[dict]:
            client = get_supabase_client()
            builder = (
                client.table("v_calendar_feed")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .order("start_at", desc=False)
            )
            if date_from:
                builder = builder.gte("start_at", date_from.isoformat())
            if date_to:
                builder = builder.lte("start_at", date_to.isoformat())
            return builder.execute().data

        return await run_blocking(_read)
