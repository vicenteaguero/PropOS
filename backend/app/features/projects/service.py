from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

PROJECTS_TABLE = "projects"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    for k in ("kind", "status"):
        if k in out and hasattr(out[k], "value"):
            out[k] = out[k].value
    return out


class ProjectService:
    @staticmethod
    async def list_projects(
        tenant_id: UUID,
        kind: str | None = None,
        status: str | None = None,
        q: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(PROJECTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("name")
            .limit(limit)
        )
        if kind:
            builder = builder.eq("kind", kind)
        if status:
            builder = builder.eq("status", status)
        if q:
            builder = builder.ilike("name", f"%{q}%")
        return builder.execute().data

    @staticmethod
    async def get_project(project_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(PROJECTS_TABLE)
            .select("*")
            .eq("id", str(project_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_project(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(PROJECTS_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_project(project_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        return (
            client.table(PROJECTS_TABLE)
            .update(data)
            .eq("id", str(project_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_project(project_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(PROJECTS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(project_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
