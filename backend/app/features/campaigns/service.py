from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

CAMPAIGNS_TABLE = "campaigns"
ADS_TABLE = "ads"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    for k in ("channel", "status"):
        if k in out and hasattr(out[k], "value"):
            out[k] = out[k].value
    return out


class CampaignService:
    @staticmethod
    async def list_campaigns(
        tenant_id: UUID,
        channel: str | None = None,
        status: str | None = None,
        q: str | None = None,
        limit: int = 100,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(CAMPAIGNS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(limit)
        )
        if channel:
            builder = builder.eq("channel", channel)
        if status:
            builder = builder.eq("status", status)
        if q:
            builder = builder.ilike("name", f"%{q}%")
        return builder.execute().data

    @staticmethod
    async def get_campaign(campaign_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(CAMPAIGNS_TABLE)
            .select("*")
            .eq("id", str(campaign_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_campaign(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(CAMPAIGNS_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_campaign(campaign_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        return (
            client.table(CAMPAIGNS_TABLE)
            .update(data)
            .eq("id", str(campaign_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_campaign(campaign_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(CAMPAIGNS_TABLE).update(
            {"deleted_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(campaign_id)).eq("tenant_id", str(tenant_id)).execute()


class AdService:
    @staticmethod
    async def list_ads(campaign_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(ADS_TABLE)
            .select("*")
            .eq("campaign_id", str(campaign_id))
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("name")
            .execute()
            .data
        )

    @staticmethod
    async def create_ad(payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        return client.table(ADS_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_ad(ad_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        return (
            client.table(ADS_TABLE)
            .update(data)
            .eq("id", str(ad_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def delete_ad(ad_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(ADS_TABLE).update(
            {"deleted_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(ad_id)).eq("tenant_id", str(tenant_id)).execute()
