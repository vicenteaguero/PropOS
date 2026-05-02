from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

TASKS_TABLE = "tasks"

logger = get_logger("TASKS")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


class TaskService:
    @staticmethod
    async def list_tasks(
        tenant_id: UUID,
        kind: str | None = None,
        status: str | None = None,
        owner_user: UUID | None = None,
        only_open: bool = False,
        limit: int = 200,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(TASKS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("priority", desc=True)
            .order("due_at", desc=False)
            .limit(limit)
        )
        if kind:
            builder = builder.eq("kind", kind)
        if status:
            builder = builder.eq("status", status)
        if owner_user is not None:
            builder = builder.eq("owner_user", str(owner_user))
        if only_open:
            builder = builder.in_("status", ["OPEN", "IN_PROGRESS", "BLOCKED"])
        return builder.execute().data

    @staticmethod
    async def get_task(task_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(TASKS_TABLE)
            .select("*")
            .eq("id", str(task_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_task(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        for k in ("kind", "status"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        data = _serialize(data)
        response = client.table(TASKS_TABLE).insert(data).execute()
        logger.info("created", event_type="write", task_id=response.data[0]["id"])
        return response.data[0]

    @staticmethod
    async def update_task(task_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        for k in ("kind", "status"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        # Auto-set completed_at when transitioning to DONE
        if data.get("status") == "DONE" and "completed_at" not in data:
            data["completed_at"] = datetime.now(UTC).isoformat()
        data = _serialize(data)
        response = (
            client.table(TASKS_TABLE).update(data).eq("id", str(task_id)).eq("tenant_id", str(tenant_id)).execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_task(task_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TASKS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(task_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
