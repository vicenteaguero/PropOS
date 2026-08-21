from __future__ import annotations

from uuid import UUID

from app.core.db import run_blocking
from app.core.supabase.client import get_supabase_client
from app.features.finance.calc import (
    DEFAULT_CURRENCY,
    empty_totals,
    month_bounds_scl,
    summarize_by_currency,
)


def _totals_rows(tenant_id: UUID, bounds: tuple[str, str] | None) -> list[dict]:
    """Ask the database for the six numbers instead of for every row.

    This used to page through `transactions` a thousand rows at a time — up to
    a hundred pages — and add them up in Python, because an unbounded
    `.execute()` is silently truncated at db-max-rows and a tenant past that
    threshold would get a plausible, incomplete total. Correct, and entirely
    unnecessary: `GROUP BY direction, status, currency` answers the same
    question in one round trip and a handful of rows, and it cannot be
    truncated because there is nothing to truncate.

    Returns the shape `summarize_by_currency` already expects — one row per
    bucket with `amount_cents` pre-added — so that function, and its tests, are
    untouched.
    """
    response = (
        get_supabase_client()
        .rpc(
            "finance_summary_totals",
            {
                "p_tenant_id": str(tenant_id),
                "p_from": bounds[0] if bounds else None,
                "p_to": bounds[1] if bounds else None,
            },
        )
        .execute()
    )
    return response.data or []


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
        bounds = month_bounds_scl(month) if month else None
        rows = await run_blocking(_totals_rows, tenant_id, bounds)
        by_currency = summarize_by_currency(rows)
        primary = by_currency.get(DEFAULT_CURRENCY) or empty_totals()

        return {
            "month": month,
            "currency": DEFAULT_CURRENCY,
            **primary,
            "by_currency": by_currency,
            "currencies": sorted(by_currency),
        }
