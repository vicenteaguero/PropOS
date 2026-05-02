from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

PUB_TABLE = "publications"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    if "status" in out and hasattr(out["status"], "value"):
        out["status"] = out["status"].value
    return out


class PublicationService:
    @staticmethod
    async def list_publications(
        tenant_id: UUID,
        property_id: UUID | None = None,
        portal_org_id: UUID | None = None,
        status: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(PUB_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if property_id:
            builder = builder.eq("property_id", str(property_id))
        if portal_org_id:
            builder = builder.eq("portal_org_id", str(portal_org_id))
        if status:
            builder = builder.eq("status", status)
        return builder.execute().data

    @staticmethod
    async def create_publication(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(PUB_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_publication(pub_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        return (
            client.table(PUB_TABLE).update(data).eq("id", str(pub_id)).eq("tenant_id", str(tenant_id)).execute().data[0]
        )

    @staticmethod
    async def delete_publication(pub_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(PUB_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(pub_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
