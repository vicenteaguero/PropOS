"""UF (Unidad de Fomento) daily snapshot service.

Source: mindicador.cl public API.
- GET /api/uf            → last 10 entries
- GET /api/uf/<yyyy>     → entire year

The persistence layer is `uf_daily` (date PK, value_clp). The endpoint flow:
1. Always try to ensure today's row first (cheapest).
2. If anything's missing in [start, today], backfill in background.

The fetch is idempotent at the DB layer (UPSERT on date), so concurrent
callers don't corrupt state.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("UF")

UF_TABLE = "uf_daily"
MINDICADOR_BASE = "https://mindicador.cl/api/uf"
BACKFILL_START = date(2024, 1, 1)
HTTP_TIMEOUT = 10.0


class UfFetchError(RuntimeError):
    pass


def _parse_iso(value: str) -> date:
    # mindicador.cl returns "2025-05-07T03:00:00.000Z" style strings.
    return datetime.fromisoformat(value.replace("Z", "+00:00")).date()


async def _fetch_recent() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(MINDICADOR_BASE)
        resp.raise_for_status()
        body = resp.json()
    return body.get("serie") or []


async def _fetch_year(year: int) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        resp = await client.get(f"{MINDICADOR_BASE}/{year}")
        resp.raise_for_status()
        body = resp.json()
    return body.get("serie") or []


def _upsert_rows(points: list[tuple[date, float]]) -> int:
    if not points:
        return 0
    client = get_supabase_client()
    payload = [
        {
            "date": d.isoformat(),
            "value_clp": float(v),
            "fetched_at": datetime.now(UTC).isoformat(),
        }
        for d, v in points
    ]
    client.table(UF_TABLE).upsert(payload, on_conflict="date").execute()
    return len(payload)


async def ensure_today() -> tuple[date, float, bool]:
    """Make sure today's UF is in DB. Returns (date, value, inserted)."""
    client = get_supabase_client()
    today = datetime.now(UTC).date()
    existing = client.table(UF_TABLE).select("value_clp").eq("date", today.isoformat()).limit(1).execute().data
    if existing:
        return today, float(existing[0]["value_clp"]), False

    serie = await _fetch_recent()
    if not serie:
        raise UfFetchError("mindicador.cl returned empty serie")

    pairs: list[tuple[date, float]] = []
    today_value: float | None = None
    for entry in serie:
        try:
            d = _parse_iso(entry["fecha"])
            v = float(entry["valor"])
        except (KeyError, ValueError, TypeError):
            continue
        pairs.append((d, v))
        if d == today:
            today_value = v

    _upsert_rows(pairs)
    if today_value is None:
        # mindicador may not have published today yet (early morning, weekends).
        # Use the most recent value as today's effective value but DON'T persist
        # it under today's date — return the latest known.
        latest = max(pairs, key=lambda p: p[0]) if pairs else None
        if latest is None:
            raise UfFetchError("no UF value available")
        return latest[0], latest[1], False
    return today, today_value, True


async def backfill_missing(start: date | None = None) -> int:
    """Find gaps in [start, today] and fill them via mindicador yearly endpoint."""
    start = start or BACKFILL_START
    today = datetime.now(UTC).date()
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

    missing_years = sorted({d.year for d in _all_business_days(start, today) if d not in have})
    inserted = 0
    for year in missing_years:
        try:
            serie = await _fetch_year(year)
        except httpx.HTTPError as exc:
            logger.warning("uf_backfill_year_failed", year=year, error=str(exc))
            continue
        pairs: list[tuple[date, float]] = []
        for entry in serie:
            try:
                d = _parse_iso(entry["fecha"])
                v = float(entry["valor"])
            except (KeyError, ValueError, TypeError):
                continue
            if start <= d <= today and d not in have:
                pairs.append((d, v))
        inserted += _upsert_rows(pairs)
    return inserted


def _all_business_days(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur = cur + timedelta(days=1)


def get_today_with_deltas() -> dict[str, Any] | None:
    """Read today's UF + month/year deltas. No network."""
    client = get_supabase_client()
    today = datetime.now(UTC).date()
    rows = (
        client.table(UF_TABLE)
        .select("date,value_clp")
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
    latest_date = max(by_date.keys())
    latest_value = by_date[latest_date]

    month_ago = latest_date - timedelta(days=30)
    year_ago = latest_date - timedelta(days=365)

    month_delta = _delta_pct(by_date, latest_value, month_ago)
    year_delta = _delta_pct(by_date, latest_value, year_ago)

    return {
        "today": {"date": latest_date, "value_clp": latest_value},
        "month_delta_pct": month_delta,
        "year_delta_pct": year_delta,
    }


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
