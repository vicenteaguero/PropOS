"""Everything one deal is made of, in one call.

A deal had no page: the kanban card was the entire surface, so participants,
the properties it touches, its stage history and — after the handshake — its
file had nowhere to live. This is what that page reads.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_thread_client
from app.features.opportunities.transitions import allowed_targets


def _client():
    # Thread-local: these run concurrently and the shared client's HTTP/2
    # connection cannot be used from two threads at once.
    return get_thread_client()


async def _gather(*calls: Callable[[], Any]) -> list[Any]:
    return list(await asyncio.gather(*(asyncio.to_thread(call) for call in calls)))


async def build_detail(tenant_id: UUID, opportunity_id: UUID) -> dict[str, Any]:
    tid, oid = str(tenant_id), str(opportunity_id)

    def deal():
        return _client().table("opportunities").select("*").eq("tenant_id", tid).eq("id", oid).single().execute().data

    def participants():
        return (
            _client()
            .table("opportunity_participants")
            .select("id,contact_id,role,created_at")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .execute()
            .data
            or []
        )

    def properties():
        return (
            _client()
            .table("opportunity_properties")
            .select("id,property_id,role,created_at")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .execute()
            .data
            or []
        )

    def history():
        return (
            _client()
            .table("opportunity_stage_history")
            .select("from_stage,to_stage,note,changed_at,changed_by")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .order("changed_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )

    def checklist():
        rows = (
            _client()
            .table("opportunity_checklists")
            .select("id")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return []
        return (
            _client()
            .table("opportunity_checklist_items")
            .select("*")
            .eq("tenant_id", tid)
            .eq("checklist_id", rows[0]["id"])
            .order("position")
            .execute()
            .data
            or []
        )

    deal_row, participant_rows, property_rows, history_rows, checklist_rows = await _gather(
        deal, participants, properties, history, checklist
    )

    # Resolve the names in one round trip each, rather than one per row.
    contact_ids = [r["contact_id"] for r in participant_rows if r.get("contact_id")]
    property_ids = [r["property_id"] for r in property_rows if r.get("property_id")]

    def names():
        if not contact_ids:
            return {}
        return {
            r["id"]: r["full_name"]
            for r in (
                _client()
                .table("contacts")
                .select("id,full_name")
                .eq("tenant_id", tid)
                .in_("id", contact_ids)
                .execute()
                .data
                or []
            )
        }

    def titles():
        if not property_ids:
            return {}
        return {
            r["id"]: r
            for r in (
                _client()
                .table("properties")
                .select("id,title,status,list_price_cents,currency")
                .eq("tenant_id", tid)
                .in_("id", property_ids)
                .execute()
                .data
                or []
            )
        }

    name_map, property_map = await _gather(names, titles)

    return {
        "opportunity": deal_row,
        "participants": [{**row, "full_name": name_map.get(row.get("contact_id"), "")} for row in participant_rows],
        "properties": [{**row, "property": property_map.get(row.get("property_id"))} for row in property_rows],
        "history": history_rows,
        "checklist": checklist_rows,
        # Only the moves that are legal from here, so the UI cannot offer one
        # the service is going to refuse.
        "allowed_transitions": allowed_targets(tenant_id, deal_row or {}),
    }
