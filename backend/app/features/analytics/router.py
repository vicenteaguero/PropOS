from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.db import gather_blocking, run_blocking
from app.core.dependencies import get_tenant_id, require_role, require_scope
from app.core.supabase.client import get_supabase_client

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_role("ADMIN")), Depends(require_scope("analytics"))],
)


# One reader per view, so the individual endpoints and the batched dashboard
# below cannot drift from each other. Each is synchronous and gets run on a
# worker thread by its caller — the Supabase client blocks, and holding the
# event loop through seven round trips is what made this page the slowest in
# the app.
def _view(view: str, tenant_id: UUID, order: str, limit: int, desc: bool = True) -> list[dict]:
    return (
        get_supabase_client()
        .table(view)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order(order, desc=desc)
        .limit(limit)
        .execute()
        .data
    )


def _revenue_monthly(tenant_id: UUID) -> list[dict]:
    return _view("mv_revenue_monthly", tenant_id, "month", 200)


def _funnel_monthly(tenant_id: UUID) -> list[dict]:
    return _view("mv_funnel_monthly", tenant_id, "month", 200)


def _ad_roi(tenant_id: UUID) -> list[dict]:
    return _view("mv_ad_roi", tenant_id, "spend_cents", 200)


def _time_on_market(tenant_id: UUID) -> list[dict]:
    return _view("mv_time_on_market", tenant_id, "days_on_market", 200)


def _person_activity(tenant_id: UUID) -> list[dict]:
    return _view("mv_person_activity", tenant_id, "week", 500)


def _pipeline(tenant_id: UUID) -> list[dict]:
    return get_supabase_client().table("v_pipeline_status").select("*").eq("tenant_id", str(tenant_id)).execute().data


def _pending_count(tenant_id: UUID) -> dict[str, Any]:
    rows = (
        get_supabase_client().table("v_open_pending_review").select("*").eq("tenant_id", str(tenant_id)).execute().data
    )
    return rows[0] if rows else {"pending_count": 0, "most_recent": None}


@router.get("/dashboard")
async def dashboard(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    """Everything the analytics page draws, in one request.

    The page mounted seven separate `useQuery` hooks, so opening it cost seven
    HTTP requests — and each of those carried the per-request authentication
    work with it, which at the time meant roughly eighty SQL statements to draw
    one screen. The reads are independent, so here they run at once and come
    back together.

    The individual endpoints stay: they are still the right shape for a widget
    that wants one series, and the agent-cost page uses its own.
    """
    revenue, funnel, roi, market, activity, pipe, pending = await gather_blocking(
        lambda: _revenue_monthly(tenant_id),
        lambda: _funnel_monthly(tenant_id),
        lambda: _ad_roi(tenant_id),
        lambda: _time_on_market(tenant_id),
        lambda: _person_activity(tenant_id),
        lambda: _pipeline(tenant_id),
        lambda: _pending_count(tenant_id),
    )
    return {
        "revenue_monthly": revenue,
        "funnel_monthly": funnel,
        "ad_roi": roi,
        "time_on_market": market,
        "person_activity": activity,
        "pipeline": pipe,
        "pending": pending,
    }


@router.get("/revenue-monthly")
async def revenue_monthly(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_revenue_monthly, tenant_id)


@router.get("/funnel-monthly")
async def funnel_monthly(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_funnel_monthly, tenant_id)


@router.get("/ad-roi")
async def ad_roi(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_ad_roi, tenant_id)


@router.get("/time-on-market")
async def time_on_market(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_time_on_market, tenant_id)


@router.get("/person-activity")
async def person_activity(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_person_activity, tenant_id)


@router.get("/pipeline")
async def pipeline(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await run_blocking(_pipeline, tenant_id)


@router.get("/pending-count")
async def pending_count(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    return await run_blocking(_pending_count, tenant_id)


@router.post("/refresh")
async def refresh(_=Depends(get_tenant_id)) -> dict[str, bool]:
    client = get_supabase_client()
    client.rpc("refresh_analytics", {}).execute()
    return {"ok": True}


@router.get("/agent-cost")
async def agent_cost(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    """Agent usage stats: tokens + cost per session, per day."""
    from datetime import UTC, datetime, timedelta

    client = get_supabase_client()
    now = datetime.now(UTC)
    since = (now - timedelta(days=30)).isoformat()

    rows = (
        client.table("agent_messages")
        .select("session_id,created_at,tokens_in,tokens_out,cost_cents,provider,model")
        .eq("tenant_id", str(tenant_id))
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
        .data
    )

    total_in = sum(r.get("tokens_in") or 0 for r in rows)
    total_out = sum(r.get("tokens_out") or 0 for r in rows)
    total_cents = sum(r.get("cost_cents") or 0 for r in rows)

    by_session: dict[str, dict[str, Any]] = {}
    for r in rows:
        sid = r["session_id"]
        slot = by_session.setdefault(
            sid,
            {
                "session_id": sid,
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_cents": 0,
                "messages": 0,
                "provider": r.get("provider"),
                "model": r.get("model"),
                "last_at": r.get("created_at"),
            },
        )
        slot["tokens_in"] += r.get("tokens_in") or 0
        slot["tokens_out"] += r.get("tokens_out") or 0
        slot["cost_cents"] += r.get("cost_cents") or 0
        slot["messages"] += 1

    by_day: dict[str, int] = {}
    for r in rows:
        day = (r["created_at"] or "")[:10]
        by_day[day] = by_day.get(day, 0) + (r.get("cost_cents") or 0)

    return {
        "totals": {
            "tokens_in": total_in,
            "tokens_out": total_out,
            "cost_cents": total_cents,
            "message_count": len(rows),
        },
        "by_session": sorted(by_session.values(), key=lambda s: s["last_at"] or "", reverse=True)[:50],
        "by_day": sorted(
            [{"day": d, "cost_cents": c} for d, c in by_day.items()],
            key=lambda x: x["day"],
        ),
    }


# The entity history is CRM, not analytics: same data source, different
# audience. Mounted separately so it can carry the gate its callers actually
# have.
timeline_router = APIRouter(
    prefix="/analytics",
    tags=["timeline"],
    dependencies=[Depends(require_role("ADMIN", "AGENT")), Depends(require_scope("crm"))],
)


@timeline_router.get("/entity-timeline")
async def entity_timeline(
    table_name: str,
    row_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    """Everything that ever happened to one record.

    On its own router because it is not analytics. It was gated on ADMIN plus
    the `analytics` scope while being linked from the contact and property
    pages, which an AGENT can open — so the link was a guaranteed 403 for every
    agent in the company.
    """
    client = get_supabase_client()
    return (
        client.table("v_entity_timeline")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .eq("table_name", table_name)
        .eq("row_id", str(row_id))
        .order("event_at", desc=True)
        .limit(100)
        .execute()
        .data
    )
