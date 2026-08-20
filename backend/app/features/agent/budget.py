"""Daily AI spend cap per tenant.

`settings.agent_daily_budget_usd` was declared but read nowhere, so the
advertised spend ceiling did not exist. This module is the consumer: it keeps
a short-lived per-tenant view of today's spend (authoritative source:
`agent_messages.cost_cents`, written by `chat._save_message`) and lets the
turn orchestrator refuse a turn before it calls the model.

The cached total is refreshed from the DB every `_CACHE_TTL_SECONDS` and
incremented locally in between, so a burst inside one TTL window still counts.
In-process state: with several Cloud Run instances each holds its own view
between refreshes, which can overshoot the cap by up to one TTL window worth
of traffic. That is the same trade-off `rate_limiter` already makes; a hard
guarantee needs the counter in Postgres.
"""

from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.core.config.settings import settings
from app.core.logging.logger import get_logger

logger = get_logger("AGENT_BUDGET")

_CACHE_TTL_SECONDS = 60.0


class BudgetExceededError(RuntimeError):
    """Today's AI spend for this tenant is at or above the configured cap."""

    def __init__(self, tenant_id: UUID, spent_usd: float, budget_usd: float) -> None:
        super().__init__(f"tenant {tenant_id} spent ${spent_usd:.4f} of ${budget_usd:.2f} today")
        self.tenant_id = tenant_id
        self.spent_usd = spent_usd
        self.budget_usd = budget_usd


@dataclass
class _Spend:
    day: str
    cents: float
    refreshed_at: float


_spend: dict[str, _Spend] = {}
_lock = threading.Lock()


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def _fetch_spend_cents(tenant_id: UUID) -> float:
    from app.core.supabase.client import get_supabase_client

    start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = (
        get_supabase_client()
        .table("agent_messages")
        .select("cost_cents")
        .eq("tenant_id", str(tenant_id))
        .gte("created_at", start_of_day)
        .limit(5000)
        .execute()
        .data
        or []
    )
    return float(sum(r.get("cost_cents") or 0 for r in rows))


def spent_today_usd(tenant_id: UUID) -> float:
    """Today's nominal spend for the tenant, in USD."""
    key = str(tenant_id)
    now = time.monotonic()
    today = _today()

    with _lock:
        entry = _spend.get(key)
        if entry is not None and entry.day == today and (now - entry.refreshed_at) < _CACHE_TTL_SECONDS:
            return entry.cents / 100.0

    cents = _fetch_spend_cents(tenant_id)
    with _lock:
        _spend[key] = _Spend(day=today, cents=cents, refreshed_at=now)
    return cents / 100.0


def record_spend_cents(tenant_id: UUID, cents: float) -> None:
    """Add a turn's cost to the cached total so bursts count before the refresh."""
    if cents <= 0:
        return
    key = str(tenant_id)
    today = _today()
    with _lock:
        entry = _spend.get(key)
        if entry is None or entry.day != today:
            # No baseline yet: seed one that is already stale so the next check
            # refetches from the DB instead of trusting this single turn.
            #
            # -inf, not 0.0. Staleness is `now - refreshed_at >= TTL` with `now`
            # from time.monotonic(), whose epoch is arbitrary — on Linux it is
            # the uptime. During the first 60 seconds of a process (a fresh
            # Cloud Run container, a CI runner) `now - 0.0` is BELOW the TTL, so
            # the sentinel read as fresh and the budget check trusted one turn's
            # cost instead of refetching. -inf is stale at any epoch.
            _spend[key] = _Spend(day=today, cents=cents, refreshed_at=-math.inf)
        else:
            entry.cents += cents


def check_daily_budget(tenant_id: UUID) -> None:
    """Raise `BudgetExceededError` when the tenant is at or over today's cap.

    A budget of 0 (or less) disables the check.
    """
    budget = settings.agent_daily_budget_usd
    if budget <= 0:
        return
    spent = spent_today_usd(tenant_id)
    if spent >= budget:
        logger.warning(
            "daily_budget_exceeded",
            event_type="quota",
            tenant_id=str(tenant_id),
            spent_usd=round(spent, 4),
            budget_usd=budget,
        )
        raise BudgetExceededError(tenant_id, spent, budget)


def reset_cache(tenant_id: UUID | str | None = None) -> None:
    """Drop the cached totals (tests, and after a manual budget change)."""
    with _lock:
        if tenant_id is None:
            _spend.clear()
        else:
            _spend.pop(str(tenant_id), None)
