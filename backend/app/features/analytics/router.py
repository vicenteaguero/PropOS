from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id, require_role
from app.core.supabase.client import get_supabase_client

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_role("ADMIN"))],
)


@router.get("/revenue-monthly")
async def revenue_monthly(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("mv_revenue_monthly")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("month", desc=True)
        .limit(200)
        .execute()
        .data
    )


@router.get("/funnel-monthly")
async def funnel_monthly(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("mv_funnel_monthly")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("month", desc=True)
        .limit(200)
        .execute()
        .data
    )


@router.get("/ad-roi")
async def ad_roi(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("mv_ad_roi")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("spend_cents", desc=True)
        .limit(200)
        .execute()
        .data
    )


@router.get("/time-on-market")
async def time_on_market(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("mv_time_on_market")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("days_on_market", desc=True)
        .limit(200)
        .execute()
        .data
    )


@router.get("/person-activity")
async def person_activity(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return (
        client.table("mv_person_activity")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("week", desc=True)
        .limit(500)
        .execute()
        .data
    )


@router.get("/pipeline")
async def pipeline(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    client = get_supabase_client()
    return client.table("v_pipeline_status").select("*").eq("tenant_id", str(tenant_id)).execute().data


@router.get("/pending-count")
async def pending_count(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    client = get_supabase_client()
    rows = client.table("v_open_pending_review").select("*").eq("tenant_id", str(tenant_id)).execute().data
    if not rows:
        return {"pending_count": 0, "most_recent": None}
    return rows[0]


@router.post("/refresh")
async def refresh(_=Depends(get_tenant_id)) -> dict[str, bool]:
    client = get_supabase_client()
    client.rpc("refresh_analytics", {}).execute()
    return {"ok": True}


@router.get("/entity-timeline")
async def entity_timeline(
    table_name: str,
    row_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
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


@router.get("/anita-cost")
async def anita_cost(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    """Anita usage stats: tokens + cost per session, per day."""
    from datetime import UTC, datetime, timedelta

    client = get_supabase_client()
    now = datetime.now(UTC)
    since = (now - timedelta(days=30)).isoformat()

    rows = (
        client.table("anita_messages")
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
