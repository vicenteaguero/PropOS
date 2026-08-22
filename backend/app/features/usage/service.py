"""Usage ingest and the numbers the Uso dashboard reads.

Ingest is deliberately dumb and cheap: validate, stamp identity from the JWT,
insert. Anything smarter belongs in the rollup, which runs once a day rather
than on every flush from every phone.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("USAGE")

EVENTS_TABLE = "usage_events"
DAILY_TABLE = "usage_daily"

# us-central1 min-instance SKUs, read from the Cloud Billing catalog
# (service 152E-C115-5142) rather than remembered:
#   Services Min Instance CPU (Request-based billing)     $0.0000025 / vCPU-second
#   Services Min Instance Memory (Request-based billing)  $0.0000025 / GiB-second
MIN_INSTANCE_CPU_USD_PER_VCPU_SECOND = 0.0000025
MIN_INSTANCE_MEM_USD_PER_GIB_SECOND = 0.0000025

# The shape config/docker/cloudbuild.yaml deploys.
SERVICE_VCPU = 2
SERVICE_MEM_GIB = 1.0

# propos-scale-up 08:00 → propos-scale-down 00:00, America/Santiago.
FLOOR_HOURS_PER_DAY = 16


def record_events(tenant_id: UUID, user_id: UUID, events: list[Any]) -> int:
    """Insert a client batch. Identity comes from the JWT, never from the body.

    A client that could name its own `user_id` would make the whole table
    unusable as evidence of anything.
    """
    rows = [
        {
            "tenant_id": str(tenant_id),
            "user_id": str(user_id),
            "kind": e.kind.value,
            "key": e.key,
            "meta": e.meta,
            "occurred_at": e.occurred_at.isoformat(),
        }
        for e in events
    ]
    get_supabase_client().table(EVENTS_TABLE).insert(rows).execute()
    return len(rows)


def _window(days: int) -> date:
    return (datetime.now(UTC) - timedelta(days=days)).date()


def daily_rows(tenant_id: UUID, days: int) -> list[dict[str, Any]]:
    """Per-user, per-day activity, with the names attached.

    Two queries rather than a join: PostgREST would need an FK-derived embed and
    `usage_daily` points at `profiles`, whose row the reader may not be able to
    embed. Looking the handful of names up separately is simpler and correct.
    """
    client = get_supabase_client()
    rows = (
        client.table(DAILY_TABLE)
        .select("user_id,day,page_views,actions,active_minutes,first_seen,last_seen")
        .eq("tenant_id", str(tenant_id))
        .gte("day", _window(days).isoformat())
        .order("day", desc=True)
        .execute()
        .data
        or []
    )
    if not rows:
        return []

    ids = list({r["user_id"] for r in rows})
    people = client.table("profiles").select("id,full_name,email").in_("id", ids).execute().data or []
    by_id = {p["id"]: p for p in people}
    for r in rows:
        person = by_id.get(r["user_id"], {})
        r["full_name"] = person.get("full_name")
        r["email"] = person.get("email")
    return rows


def top_keys(tenant_id: UUID, days: int, limit: int = 15) -> list[dict[str, Any]]:
    """The most-opened screens and most-used actions in the window.

    Counted in Python over the raw events. That is honest at this size -- a few
    thousand rows for a brokerage of three -- and the alternative is another
    materialized view to keep fresh. Revisit when a tenant outgrows it; the
    `LIMIT` below is what will start lying first.
    """
    cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    rows = (
        get_supabase_client()
        .table(EVENTS_TABLE)
        .select("kind,key")
        .eq("tenant_id", str(tenant_id))
        .gte("occurred_at", cutoff)
        .neq("kind", "session_ping")
        .limit(20_000)
        .execute()
        .data
        or []
    )
    counts: dict[tuple[str, str], int] = {}
    for r in rows:
        counts[(r["kind"], r["key"])] = counts.get((r["kind"], r["key"]), 0) + 1
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])[:limit]
    return [{"kind": kind, "key": key, "count": n} for (kind, key), n in ranked]


def cost_estimate(days: int, floor_hours_per_day: int = FLOOR_HOURS_PER_DAY) -> dict[str, Any]:
    """What the always-warm instance cost over the window.

    Not a bill and does not pretend to be one: it prices the instance FLOOR,
    which is the part of the bill the schedule controls and the only part that
    accrues whether anyone opens the app or not. Per-request compute, egress and
    Supabase are not in here.
    """
    seconds = days * floor_hours_per_day * 3600
    cpu = SERVICE_VCPU * seconds * MIN_INSTANCE_CPU_USD_PER_VCPU_SECOND
    mem = SERVICE_MEM_GIB * seconds * MIN_INSTANCE_MEM_USD_PER_GIB_SECOND
    monthly_seconds = 30 * floor_hours_per_day * 3600
    return {
        "window_days": days,
        "floor_hours_per_day": floor_hours_per_day,
        "cpu_usd": round(cpu, 2),
        "memory_usd": round(mem, 2),
        "total_usd": round(cpu + mem, 2),
        "projected_monthly_usd": round(
            monthly_seconds
            * (
                SERVICE_VCPU * MIN_INSTANCE_CPU_USD_PER_VCPU_SECOND
                + SERVICE_MEM_GIB * MIN_INSTANCE_MEM_USD_PER_GIB_SECOND
            ),
            2,
        ),
    }


def summary(tenant_id: UUID, days: int) -> dict[str, Any]:
    return {
        "days": daily_rows(tenant_id, days),
        "top_keys": top_keys(tenant_id, days),
        "cost": cost_estimate(days),
    }


def run_rollup(days_back: int = 2) -> dict[str, Any]:
    """Recompute the last few days of `usage_daily` and purge old raw events."""
    client = get_supabase_client()
    resp = client.rpc("rollup_usage_daily", {"days_back": days_back}).execute()
    logger.info("usage_rollup", event_type="job", days_back=days_back)
    return {"rolled_up": resp.data if resp.data is not None else 0}
