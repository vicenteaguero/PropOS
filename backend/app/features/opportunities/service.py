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
        if isinstance(v, datetime | date):
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
        offset: int = 0,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(OPP_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
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
        is_won = data.get("status") == "WON"
        if data.get("status") in ("WON", "LOST") and "closed_at" not in data:
            data["closed_at"] = datetime.now(UTC).isoformat()
        row = (
            client.table(OPP_TABLE).update(data).eq("id", str(opp_id)).eq("tenant_id", str(tenant_id)).execute().data[0]
        )
        if is_won:
            OpportunityService._spawn_commission_receivable(client, row, tenant_id)
        return row

    @staticmethod
    def _spawn_commission_receivable(client, opp: dict, tenant_id: UUID) -> None:
        """On WIN: create a PENDING 'por cobrar' commission transaction.

        Idempotent-ish: skipped if a commission transaction already references
        this opportunity (via metadata.opportunity_id).
        """
        from datetime import timedelta

        from app.features.finance.calc import DEFAULT_CURRENCY, commission

        value = opp.get("expected_value_cents")
        if not value:
            return
        existing = (
            client.table("transactions")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .contains("metadata", {"opportunity_id": str(opp["id"])})
            .limit(1)
            .execute()
            .data
        )
        if existing:
            return

        rate = opp.get("commission_rate_pct")
        if rate is None:
            tenant = client.table("tenants").select("settings").eq("id", str(tenant_id)).single().execute().data or {}
            rate = ((tenant.get("settings") or {}).get("finance") or {}).get("commission_rate_pct", 2.0)
        calc = commission(int(value), float(rate))
        due = (datetime.now(UTC) + timedelta(days=30)).isoformat()
        client.table("transactions").insert(
            {
                "tenant_id": str(tenant_id),
                "direction": "IN",
                "category": "COMMISSION",
                "amount_cents": calc["gross_cents"],
                # The deal's own currency: defaulting to CLP would book a UF
                # receivable as pesos, off by ~40.000x.
                "currency": opp.get("currency") or DEFAULT_CURRENCY,
                "status": "PENDING",
                "occurred_at": datetime.now(UTC).isoformat(),
                "due_at": due,
                "description": "Comisión por oportunidad ganada",
                "payer_person_id": opp.get("person_id"),
                "related_property_id": opp.get("property_id"),
                "source": "system",
                "metadata": {"opportunity_id": str(opp["id"])},
            }
        ).execute()

    @staticmethod
    async def delete_opportunity(opp_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(OPP_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(opp_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
