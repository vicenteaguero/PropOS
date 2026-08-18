from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.finance.calc import (
    DEFAULT_CURRENCY,
    empty_totals,
    month_bounds_scl,
    summarize_by_currency,
)

logger = get_logger("FINANCE")

# PostgREST silently truncates at the project's db-max-rows, so the summary
# walks the result set in explicit pages instead of asking for "everything".
PAGE_SIZE = 1000
MAX_PAGES = 100


def _fetch_all(make_builder: Callable[[], object]) -> list[dict]:
    """Page through a PostgREST query until it runs dry.

    A single unbounded ``.execute()`` is capped by db-max-rows without raising,
    so a tenant past that threshold would get a plausible, incomplete total.
    Each page needs a fresh builder: postgrest-py *appends* the offset/limit
    query params instead of replacing them, so a reused builder would carry
    every previous page's range.
    """
    rows: list[dict] = []
    for page in range(MAX_PAGES):
        start = page * PAGE_SIZE
        chunk = make_builder().range(start, start + PAGE_SIZE - 1).execute().data or []
        rows.extend(chunk)
        if len(chunk) < PAGE_SIZE:
            return rows
    logger.warning("summary_page_cap_hit", event_type="query", rows=len(rows), max_pages=MAX_PAGES)
    return rows


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
        bounds = month_bounds_scl(month) if month else None

        def build():
            builder = (
                client.table("transactions")
                .select("direction, status, amount_cents, currency")
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .order("occurred_at")
            )
            if bounds:
                # occurred_at is timestamptz: half-open [first, next-month) window
                # with Santiago offsets, not bare dates (read by Postgres as UTC).
                builder = builder.gte("occurred_at", bounds[0]).lt("occurred_at", bounds[1])
            return builder

        rows = _fetch_all(build)
        by_currency = summarize_by_currency(rows)
        primary = by_currency.get(DEFAULT_CURRENCY) or empty_totals()

        return {
            "month": month,
            "currency": DEFAULT_CURRENCY,
            **primary,
            "by_currency": by_currency,
            "currencies": sorted(by_currency),
        }
