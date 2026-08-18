from __future__ import annotations

from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.finance.calc import (
    DEFAULT_CURRENCY,
    empty_totals,
    month_bounds_scl,
    summarize_by_currency,
)


class FinanceService:
    @staticmethod
    async def summary(tenant_id: UUID, month: str | None = None) -> dict:
        """Aggregate IN/OUT totals + por-cobrar / por-pagar for the tenant.

        ``month`` is an optional 'YYYY-MM' filter on occurred_at, resolved in
        Santiago wall-clock time. Totals are grouped per currency: the flat
        ``*_cents`` keys carry CLP (the default currency) and ``by_currency``
        exposes every currency present, so a UF row can never be added to a
        CLP row.
        """
        client = get_supabase_client()
        builder = (
            client.table("transactions")
            .select("direction, status, amount_cents, currency")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
        )
        if month:
            # occurred_at is timestamptz: half-open [first, next-month) window
            # with Santiago offsets, not bare dates (which Postgres reads as UTC).
            start, end = month_bounds_scl(month)
            builder = builder.gte("occurred_at", start).lt("occurred_at", end)
        rows = builder.execute().data or []

        by_currency = summarize_by_currency(rows)
        primary = by_currency.get(DEFAULT_CURRENCY) or empty_totals()

        return {
            "month": month,
            "currency": DEFAULT_CURRENCY,
            **primary,
            "by_currency": by_currency,
            "currencies": sorted(by_currency),
        }
