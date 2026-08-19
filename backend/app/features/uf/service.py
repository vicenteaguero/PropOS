"""UF (Unidad de Fomento) daily snapshot service.

Sources live in `app.features.uf.providers` and are tried in the order given by
`settings.uf_sources` (default: SII, then mindicador.cl). All sources republish
the same Banco Central series, so falling through costs nothing in accuracy.

The persistence layer is `uf_daily` (date PK, value_clp, source). The endpoint
flow:
1. Always try to ensure today's row first (cheapest).
2. If anything's missing in [start, today], backfill in background.

The fetch is idempotent at the DB layer (UPSERT on date), so concurrent
callers don't corrupt state.

Forward values: the UF for a whole month is fixed and published on the 9th of
the previous month, so `uf_daily` legitimately holds rows dated after today.
Every read that means "current value" filters `date <= today`; `get_forward()`
is the one that deliberately looks ahead.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.uf.providers import (
    SANTIAGO,
    UfProvider,
    UfProviderError,
    UfSeries,
    build_chain,
    today_santiago,
)

logger = get_logger("UF")

UF_TABLE = "uf_daily"
BACKFILL_START = date(2024, 1, 1)

__all__ = [
    "BACKFILL_START",
    "SANTIAGO",
    "UfFetchError",
    "backfill_missing",
    "ensure_today",
    "get_forward",
    "get_today_with_deltas",
]


class UfFetchError(RuntimeError):
    """No configured provider could deliver a series."""


def _upsert_rows(points: UfSeries, source: str) -> int:
    if not points:
        return 0
    client = get_supabase_client()
    now = datetime.now(UTC).isoformat()
    payload = [
        {
            "date": d.isoformat(),
            "value_clp": float(v),
            "fetched_at": now,
            "source": source,
        }
        for d, v in points
    ]
    client.table(UF_TABLE).upsert(payload, on_conflict="date").execute()
    return len(payload)


async def _try_chain(fetch: str, year: int | None = None) -> tuple[UfProvider, UfSeries] | None:
    """Run the provider chain until one returns a non-empty series.

    `fetch` is either "recent" or "year". Returns None when every provider
    failed or had nothing; callers decide whether that is fatal.
    """
    errors: list[str] = []
    for provider in build_chain():
        try:
            if fetch == "recent":
                series = await provider.fetch_recent()
            else:
                series = await provider.fetch_year(year or 0)
        except UfProviderError as exc:
            errors.append(str(exc))
            logger.warning("uf_provider_failed", provider=provider.name, fetch=fetch, error=str(exc))
            continue
        except Exception as exc:  # noqa: BLE001 — a broken provider must not break the chain
            errors.append(f"{provider.name}: {exc}")
            logger.exception("uf_provider_crashed", provider=provider.name, fetch=fetch)
            continue
        if series:
            return provider, series
        logger.info("uf_provider_empty", provider=provider.name, fetch=fetch, year=year)
    if errors:
        logger.warning("uf_chain_exhausted", fetch=fetch, year=year, errors=errors)
    return None


async def ensure_today() -> tuple[date, float, bool]:
    """Make sure today's UF is in DB. Returns (date, value, inserted)."""
    client = get_supabase_client()
    today = today_santiago()
    existing = (
        client.table(UF_TABLE).select("value_clp").eq("date", today.isoformat()).limit(1).execute().data
    )
    if existing:
        return today, float(existing[0]["value_clp"]), False

    result = await _try_chain("recent")
    if result is None:
        raise UfFetchError("no UF provider returned a series")
    provider, series = result

    _upsert_rows(series, provider.name)

    by_date = dict(series)
    if today in by_date:
        return today, by_date[today], True

    # The source may not have published today yet (early morning, weekends).
    # Use the most recent value at or before today as the effective value, but
    # DON'T persist it under today's date.
    past = [d for d in by_date if d <= today]
    if not past:
        raise UfFetchError("no UF value available for today or earlier")
    latest = max(past)
    return latest, by_date[latest], False


async def backfill_missing(start: date | None = None) -> int:
    """Find gaps in [start, today] and fill them, one provider call per year."""
    start = start or BACKFILL_START
    today = today_santiago()
    client = get_supabase_client()

    existing_rows = (
        client.table(UF_TABLE)
        .select("date")
        .gte("date", start.isoformat())
        .lte("date", today.isoformat())
        .execute()
        .data
        or []
    )
    have = {datetime.fromisoformat(r["date"]).date() for r in existing_rows}

    missing_years = sorted({d.year for d in _all_days(start, today) if d not in have})
    inserted = 0
    for year in missing_years:
        result = await _try_chain("year", year)
        if result is None:
            continue
        provider, series = result
        # Keep forward rows from the current year's page — they are published
        # values, not projections — but never rows before the backfill window.
        pairs = [(d, v) for d, v in series if d >= start and d not in have]
        inserted += _upsert_rows(pairs, provider.name)
    return inserted


def _all_days(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur = cur + timedelta(days=1)


def get_today_with_deltas() -> dict[str, Any] | None:
    """Read today's UF + month/year deltas. No network."""
    client = get_supabase_client()
    today = today_santiago()
    rows = (
        client.table(UF_TABLE)
        .select("date,value_clp,source")
        .lte("date", today.isoformat())
        .order("date", desc=True)
        .limit(400)
        .execute()
        .data
        or []
    )
    if not rows:
        return None

    by_date = {datetime.fromisoformat(r["date"]).date(): float(r["value_clp"]) for r in rows}
    source_by_date = {datetime.fromisoformat(r["date"]).date(): r.get("source") for r in rows}
    latest_date = max(by_date.keys())
    latest_value = by_date[latest_date]

    month_ago = latest_date - timedelta(days=30)
    year_ago = latest_date - timedelta(days=365)

    return {
        "today": {
            "date": latest_date,
            "value_clp": latest_value,
            "source": source_by_date.get(latest_date),
        },
        "month_delta_pct": _delta_pct(by_date, latest_value, month_ago),
        "year_delta_pct": _delta_pct(by_date, latest_value, year_ago),
    }


def get_forward(limit: int = 45) -> list[dict[str, Any]]:
    """Already-published UF values dated after today, oldest first.

    These are official, not projections: the Banco Central fixes the whole
    10th → 9th window in advance, which is what lets a broker price a closing
    or a lease adjustment on a future date.
    """
    client = get_supabase_client()
    today = today_santiago()
    rows = (
        client.table(UF_TABLE)
        .select("date,value_clp,source")
        .gt("date", today.isoformat())
        .order("date", desc=False)
        .limit(limit)
        .execute()
        .data
        or []
    )
    return [
        {
            "date": datetime.fromisoformat(r["date"]).date(),
            "value_clp": float(r["value_clp"]),
            "source": r.get("source"),
        }
        for r in rows
    ]


def _delta_pct(by_date: dict[date, float], current: float, target: date) -> float | None:
    # Find the closest available date <= target.
    candidates = [d for d in by_date if d <= target]
    if not candidates:
        return None
    base_date = max(candidates)
    base = by_date[base_date]
    if base == 0:
        return None
    return round((current - base) / base * 100, 2)
