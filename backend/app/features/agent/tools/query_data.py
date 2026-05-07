"""Safe analytics query DSL — NO raw SQL from the LLM.

Each `view` enum value maps to a parameterized query implementation.
Allowed filter keys are whitelisted per view.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client


def run_query(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    view = args.get("view")
    filters = args.get("filters") or {}
    handler = _VIEWS.get(view)
    if handler is None:
        return {"error": f"unsupported view {view!r}", "supported": list(_VIEWS.keys())}
    try:
        return handler(filters, tenant_id)
    except Exception as exc:  # pragma: no cover - defensive
        return {"error": f"query failed: {exc}"}


def _v_transactions_summary(filters, tenant_id):
    client = get_supabase_client()
    builder = (
        client.table("transactions")
        .select("direction,category,amount_cents,occurred_at,related_campaign_id,related_project_id")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(500)
    )
    for k in ("direction", "category"):
        if k in filters and filters[k]:
            builder = builder.eq(k, filters[k])
    if filters.get("project_id"):
        builder = builder.eq("related_project_id", filters["project_id"])
    if filters.get("campaign_id"):
        builder = builder.eq("related_campaign_id", filters["campaign_id"])
    if filters.get("month"):
        # YYYY-MM
        m = filters["month"]
        builder = builder.gte("occurred_at", f"{m}-01").lte("occurred_at", f"{m}-31T23:59:59")
    rows = builder.execute().data
    total_cents = sum(r["amount_cents"] for r in rows)
    return {
        "rows": rows[:50],
        "summary": {
            "count": len(rows),
            "total_cents": total_cents,
            "total_clp": total_cents // 100,
        },
    }


def _v_tasks_open_count(filters, tenant_id):
    client = get_supabase_client()
    rows = (
        client.table("tasks")
        .select("kind,status,due_at,owner_user")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .in_("status", ["OPEN", "IN_PROGRESS", "BLOCKED"])
        .limit(500)
        .execute()
        .data
    )
    by_kind: dict[str, int] = {}
    for r in rows:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    return {"summary": {"total": len(rows), "by_kind": by_kind}, "rows": rows[:50]}


def _v_interactions_count(filters, tenant_id):
    client = get_supabase_client()
    builder = (
        client.table("interactions")
        .select("kind,occurred_at")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(500)
    )
    if filters.get("kind"):
        builder = builder.eq("kind", filters["kind"])
    if filters.get("month"):
        m = filters["month"]
        builder = builder.gte("occurred_at", f"{m}-01").lte("occurred_at", f"{m}-31T23:59:59")
    rows = builder.execute().data
    return {"summary": {"count": len(rows)}, "rows": rows[:50]}


def _v_opportunities_pipeline(filters, tenant_id):
    client = get_supabase_client()
    rows = (
        client.table("opportunities")
        .select("id,pipeline_stage,status,expected_value_cents,expected_close_at")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(500)
        .execute()
        .data
    )
    by_stage: dict[str, dict[str, Any]] = {}
    for r in rows:
        s = r["pipeline_stage"]
        slot = by_stage.setdefault(s, {"count": 0, "value_cents": 0})
        slot["count"] += 1
        slot["value_cents"] += r.get("expected_value_cents") or 0
    return {"summary": {"by_stage": by_stage}, "rows": rows[:50]}


_VIEWS = {
    "transactions_summary": _v_transactions_summary,
    "tasks_open_count": _v_tasks_open_count,
    "interactions_count": _v_interactions_count,
    "opportunities_pipeline": _v_opportunities_pipeline,
}
