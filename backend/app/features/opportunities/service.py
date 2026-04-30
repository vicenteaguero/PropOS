from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

OPP_TABLE = "opportunities"
HISTORY_TABLE = "opportunity_stage_history"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    if "status" in out and hasattr(out["status"], "value"):
        out["status"] = out["status"].value
    return out


class OpportunityService:
    @staticmethod
    async def list_opportunities(
        tenant_id: UUID,
        status: str | None = None,
        stage: str | None = None,
        person_id: UUID | None = None,
        property_id: UUID | None = None,
        limit: int = 200,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(OPP_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if status:
            builder = builder.eq("status", status)
        if stage:
            builder = builder.eq("pipeline_stage", stage)
        if person_id:
            builder = builder.eq("person_id", str(person_id))
        if property_id:
            builder = builder.eq("property_id", str(property_id))
        return builder.execute().data

    @staticmethod
    async def get_opportunity(opp_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(OPP_TABLE)
            .select("*")
            .eq("id", str(opp_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def get_history(opp_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(HISTORY_TABLE)
            .select("*")
            .eq("opportunity_id", str(opp_id))
            .eq("tenant_id", str(tenant_id))
            .order("changed_at", desc=True)
            .execute()
            .data
        )

    @staticmethod
    async def create_opportunity(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(OPP_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_opportunity(opp_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        if data.get("status") in ("WON", "LOST") and "closed_at" not in data:
            data["closed_at"] = datetime.now(UTC).isoformat()
        return (
            client.table(OPP_TABLE)
            .update(data)
            .eq("id", str(opp_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_opportunity(opp_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(OPP_TABLE).update(
            {"deleted_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(opp_id)).eq("tenant_id", str(tenant_id)).execute()
