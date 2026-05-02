from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

TX_TABLE = "transactions"

logger = get_logger("TRANSACTIONS")


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


class TransactionService:
    @staticmethod
    async def list_transactions(
        tenant_id: UUID,
        direction: str | None = None,
        category: str | None = None,
        project_id: UUID | None = None,
        campaign_id: UUID | None = None,
        property_id: UUID | None = None,
        limit: int = 200,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(TX_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("occurred_at", desc=True)
            .limit(limit)
        )
        if direction:
            builder = builder.eq("direction", direction)
        if category:
            builder = builder.eq("category", category)
        if project_id is not None:
            builder = builder.eq("related_project_id", str(project_id))
        if campaign_id is not None:
            builder = builder.eq("related_campaign_id", str(campaign_id))
        if property_id is not None:
            builder = builder.eq("related_property_id", str(property_id))
        return builder.execute().data

    @staticmethod
    async def get_transaction(tx_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(TX_TABLE)
            .select("*")
            .eq("id", str(tx_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_transaction(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        for k in ("direction", "category"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        if not data.get("occurred_at"):
            data["occurred_at"] = datetime.now(UTC).isoformat()
        data = _serialize(data)
        response = client.table(TX_TABLE).insert(data).execute()
        logger.info(
            "created",
            event_type="write",
            tx_id=response.data[0]["id"],
            amount=data.get("amount_cents"),
        )
        return response.data[0]

    @staticmethod
    async def update_transaction(tx_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        for k in ("direction", "category"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        data = _serialize(data)
        response = client.table(TX_TABLE).update(data).eq("id", str(tx_id)).eq("tenant_id", str(tenant_id)).execute()
        return response.data[0]

    @staticmethod
    async def delete_transaction(tx_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TX_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(tx_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
