"""One call that answers "what is going on with this deal".

`build_detail` already returns the deal's own shape — participants, properties,
stage history, checklist. What it cannot answer is the question people actually
open a deal to ask: what is booked, what is owed, what is pending, what has been
written down. Those live in five other tables, and a UI that fetched them
separately would make five round trips to draw one card.

Mirrors `features/contacts/overview.py`, including its threading: the Supabase
client is synchronous, so every read here runs on a worker thread and they are
gathered, turning N stacked network latencies into one.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Callable
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_thread_client

#: Cap per source. A deal with more than this many notes is not a display
#: problem we need to solve today.
_LIMIT = 100

_OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "BLOCKED")


def _client():
    # Thread-local: the shared client's connection cannot be used by two
    # threads at once, and everything below runs inside `asyncio.to_thread`.
    return get_thread_client()


async def _gather(*calls: Callable[[], Any]) -> list[Any]:
    return list(await asyncio.gather(*(asyncio.to_thread(call) for call in calls)))


async def build_overview(tenant_id: UUID, opportunity_id: UUID) -> dict:
    tid, oid = str(tenant_id), str(opportunity_id)
    now = dt.datetime.now(dt.UTC)

    def opportunity():
        rows = (
            _client()
            .table("opportunities")
            .select(
                "id, tenant_id, pipeline_id, pipeline_stage, status, person_id, property_id,"
                " expected_value_cents, currency, probability, expected_close_at, closed_at,"
                " lost_reason, notes, created_at, updated_at"
            )
            .eq("tenant_id", tid)
            .eq("id", oid)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    def participants():
        return (
            _client()
            .table("opportunity_participants")
            .select("contact_id, role")
            .eq("opportunity_id", oid)
            .limit(_LIMIT)
            .execute()
            .data
            or []
        )

    def properties():
        return (
            _client()
            .table("opportunity_properties")
            .select("property_id, role")
            .eq("opportunity_id", oid)
            .limit(_LIMIT)
            .execute()
            .data
            or []
        )

    def next_event():
        return (
            _client()
            .table("events")
            .select("id, title, kind, starts_at, ends_at, all_day, location, property_id, status")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .is_("deleted_at", "null")
            .gte("starts_at", now.isoformat())
            .order("starts_at")
            .limit(1)
            .execute()
            .data
            or []
        )

    def open_tasks():
        # `tasks.related` is a JSONB soft link, so this is a containment match
        # rather than a join. The GIN index on it is what makes that cheap.
        return (
            _client()
            .table("tasks")
            .select("id, title, due_at, priority, status")
            .eq("tenant_id", tid)
            .in_("status", _OPEN_TASK_STATUSES)
            .is_("deleted_at", "null")
            .contains("related", {"opportunities": [oid]})
            .order("due_at")
            .limit(_LIMIT)
            .execute()
            .data
            or []
        )

    def note_links():
        return (
            _client()
            .table("note_targets")
            .select("note_id")
            .eq("tenant_id", tid)
            .eq("opportunity_id", oid)
            .limit(_LIMIT)
            .execute()
            .data
            or []
        )

    opp, parts, props, events, tasks, notes = await _gather(
        opportunity, participants, properties, next_event, open_tasks, note_links
    )
    if not opp:
        return {}

    contact_ids = [p["contact_id"] for p in parts if p.get("contact_id")]
    property_ids = [p["property_id"] for p in props if p.get("property_id")]
    if opp.get("property_id") and opp["property_id"] not in property_ids:
        property_ids.append(opp["property_id"])
    if opp.get("person_id") and opp["person_id"] not in contact_ids:
        contact_ids.append(opp["person_id"])

    def contact_rows():
        if not contact_ids:
            return []
        return (
            _client()
            .table("contacts")
            .select("id, full_name, phone, email")
            .eq("tenant_id", tid)
            .in_("id", contact_ids)
            .execute()
            .data
            or []
        )

    def property_rows():
        if not property_ids:
            return []
        return (
            _client()
            .table("properties")
            .select("id, title, address, status, list_price_cents, currency")
            .eq("tenant_id", tid)
            .in_("id", property_ids)
            .execute()
            .data
            or []
        )

    def document_rows():
        """Documents are derived, not linked.

        `document_assignments` only admits CONTACT / PROPERTY / INTERNAL_AREA —
        there is no deal target — so "the deal's documents" means the ones
        hanging off its property or off any of its participants. Deriving costs
        one query and no schema change, and it matches what a broker means.
        """
        if not property_ids and not contact_ids:
            return []
        query = _client().table("document_assignments").select("document_id").eq("tenant_id", tid)
        if property_ids and contact_ids:
            ors = ",".join(
                [f"property_id.in.({','.join(property_ids)})"] + [f"contact_id.in.({','.join(contact_ids)})"]
            )
            query = query.or_(ors)
        elif property_ids:
            query = query.in_("property_id", property_ids)
        else:
            query = query.in_("contact_id", contact_ids)
        return query.limit(_LIMIT).execute().data or []

    def transaction_rows():
        """Money is derived too — `transactions` has no deal column.

        It links to a property (`related_property_id`) and to a payer
        (`payer_person_id`), so the deal's money is whatever is booked against
        its property or owed by one of its participants.
        """
        if not property_ids and not contact_ids:
            return []
        query = (
            _client()
            .table("transactions")
            .select("id, description, amount_cents, currency, status, due_at, category")
            .eq("tenant_id", tid)
            .is_("deleted_at", "null")
        )
        if property_ids and contact_ids:
            query = query.or_(
                f"related_property_id.in.({','.join(property_ids)}),payer_person_id.in.({','.join(contact_ids)})"
            )
        elif property_ids:
            query = query.in_("related_property_id", property_ids)
        else:
            query = query.in_("payer_person_id", contact_ids)
        return query.order("due_at").limit(_LIMIT).execute().data or []

    contacts, props_full, txns, doc_links = await _gather(contact_rows, property_rows, transaction_rows, document_rows)

    by_contact = {c["id"]: c for c in contacts}
    by_property = {p["id"]: p for p in props_full}
    role_by_contact = {p["contact_id"]: p.get("role") for p in parts if p.get("contact_id")}
    role_by_property = {p["property_id"]: p.get("role") for p in props if p.get("property_id")}

    pending_cents = sum((t.get("amount_cents") or 0) for t in txns if (t.get("status") or "") == "PENDING")

    return {
        "opportunity": opp,
        "participants": [
            {
                "id": cid,
                "full_name": (by_contact.get(cid) or {}).get("full_name"),
                "phone": (by_contact.get(cid) or {}).get("phone"),
                "role": role_by_contact.get(cid),
            }
            for cid in contact_ids
        ],
        "properties": [
            {
                "id": pid,
                "title": (by_property.get(pid) or {}).get("title"),
                "address": (by_property.get(pid) or {}).get("address"),
                "status": (by_property.get(pid) or {}).get("status"),
                "list_price_cents": (by_property.get(pid) or {}).get("list_price_cents"),
                "currency": (by_property.get(pid) or {}).get("currency"),
                "role": role_by_property.get(pid),
            }
            for pid in property_ids
        ],
        "next_event": events[0] if events else None,
        "open_tasks": tasks,
        "transactions": txns,
        "pending_amount_cents": pending_cents,
        "counts": {
            "participants": len(contact_ids),
            "properties": len(property_ids),
            "open_tasks": len(tasks),
            "notes": len({n["note_id"] for n in notes}),
            "documents": len({d["document_id"] for d in doc_links}),
            "transactions": len(txns),
        },
    }
