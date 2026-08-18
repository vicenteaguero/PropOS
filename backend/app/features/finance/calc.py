"""Pure financial helpers. No I/O — trivially unit-testable."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

DEFAULT_IVA_PCT = 19.0
DEFAULT_CURRENCY = "CLP"

# The product is Chile-only: month boundaries are wall-clock Santiago, never UTC.
SANTIAGO = ZoneInfo("America/Santiago")

_MONTH_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def commission(amount_cents: int, rate_pct: float, iva_pct: float = DEFAULT_IVA_PCT) -> dict[str, int]:
    """Broker commission on a deal value.

    net   = amount * rate%
    iva   = net * iva%   (Chile: 19% IVA on the service fee)
    gross = net + iva

    All returned values are integer cents (banker-free round-half-up via int()).
    """
    net = round(amount_cents * (rate_pct / 100.0))
    iva = round(net * (iva_pct / 100.0))
    return {"net_cents": int(net), "iva_cents": int(iva), "gross_cents": int(net + iva)}


def month_bounds_scl(month: str) -> tuple[str, str]:
    """Half-open ``[start, next_month)`` bounds for a 'YYYY-MM' in Santiago time.

    Timestamp columns are ``timestamptz``; a bare date literal like '2026-08-01'
    is read by Postgres as midnight UTC, which is 20:00/21:00 of July 31 in
    Chile — every month close would drag ~4 hours of rows into the wrong month.
    Returning offset-aware ISO strings pins the window to the local calendar.
    """
    match = _MONTH_RE.match(month or "")
    if not match:
        raise ValueError(f"invalid month, expected YYYY-MM: {month!r}")
    year, mon = int(match.group(1)), int(match.group(2))
    start = datetime(year, mon, 1, tzinfo=SANTIAGO)
    nxt = datetime(year + (mon == 12), (mon % 12) + 1, 1, tzinfo=SANTIAGO)
    return start.isoformat(), nxt.isoformat()


def empty_totals() -> dict[str, int]:
    return {
        "income_cents": 0,
        "expense_cents": 0,
        "net_cents": 0,
        "receivable_cents": 0,
        "payable_cents": 0,
    }


def summarize_by_currency(rows: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, int]]:
    """Total transaction rows per currency.

    Summing CLP and UF into one figure yields a plausible but meaningless
    number, so each currency gets its own bucket. Rows with no currency fall
    back to CLP, the column default.
    """
    buckets: dict[str, dict[str, int]] = {}
    for row in rows:
        currency = (row.get("currency") or DEFAULT_CURRENCY).upper()
        totals = buckets.setdefault(currency, empty_totals())
        amount = int(row.get("amount_cents") or 0)
        direction = row.get("direction")
        status = row.get("status")
        if direction == "IN" and status == "COMPLETED":
            totals["income_cents"] += amount
        elif direction == "OUT" and status == "COMPLETED":
            totals["expense_cents"] += amount
        elif direction == "IN" and status == "PENDING":
            totals["receivable_cents"] += amount
        elif direction == "OUT" and status == "PENDING":
            totals["payable_cents"] += amount
    for totals in buckets.values():
        totals["net_cents"] = totals["income_cents"] - totals["expense_cents"]
    return buckets
