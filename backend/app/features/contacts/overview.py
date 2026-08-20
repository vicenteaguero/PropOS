"""One call that answers "where does this relationship stand right now".

The person page had a tab per table — interactions, deals, notes, emails — and
each tab fetched only when opened, so the first thing a broker saw about a
client was their phone number and four empty labels. Everything that decides
what to do next (when we last spoke, what is booked, what is open, what it is
worth) required opening tabs and reading dates.

This batches those reads into one response so the page can lead with the state
of the relationship instead of the shape of the schema.
"""

from __future__ import annotations

import datetime as dt
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.contacts.schemas import (
    ContactOverview,
    OverviewCounts,
    OverviewDeal,
    OverviewEvent,
    OverviewProperty,
)

#: How many linked rows we are willing to pull per source for one person.
_LIMIT = 200

_OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "BLOCKED")


def _client():
    return get_supabase_client()


def _count(table: str, tenant_id: UUID, column: str, value: str, *, soft_delete: bool = True) -> int:
    q = _client().table(table).select("id", count="exact").eq("tenant_id", str(tenant_id)).eq(column, value)
    if soft_delete:
        q = q.is_("deleted_at", "null")
    return q.limit(1).execute().count or 0


def build_overview(tenant_id: UUID, contact_id: UUID) -> ContactOverview:
    tid, cid = str(tenant_id), str(contact_id)
    now = dt.datetime.now(dt.UTC)
    client = _client()

    # --- last interaction: participants → interactions, newest first ---
    participant_rows = (
        client.table("interaction_participants")
        .select("interaction_id")
        .eq("tenant_id", tid)
        .eq("person_id", cid)
        .limit(_LIMIT)
        .execute()
        .data
        or []
    )
    interaction_ids = [row["interaction_id"] for row in participant_rows if row.get("interaction_id")]
    last_interaction_at: dt.datetime | None = None
    last_interaction_kind: str | None = None
    if interaction_ids:
        latest = (
            client.table("interactions")
            .select("id,kind,occurred_at")
            .eq("tenant_id", tid)
            .in_("id", interaction_ids)
            .is_("deleted_at", "null")
            .order("occurred_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if latest:
            last_interaction_at = latest[0].get("occurred_at")
            last_interaction_kind = latest[0].get("kind")

    # --- open deals, with the property each is about ---
    deal_rows = (
        client.table("opportunities")
        .select("id,pipeline_stage,property_id,expected_value_cents,currency,updated_at")
        .eq("tenant_id", tid)
        .eq("person_id", cid)
        .eq("status", "OPEN")
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(_LIMIT)
        .execute()
        .data
        or []
    )
    property_ids = [row["property_id"] for row in deal_rows if row.get("property_id")]

    # --- next booked thing ---
    event_rows = (
        client.table("events")
        .select("id,kind,title,starts_at,location,property_id")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .eq("status", "SCHEDULED")
        .gte("starts_at", now.isoformat())
        .is_("deleted_at", "null")
        .order("starts_at")
        .limit(1)
        .execute()
        .data
        or []
    )
    if event_rows and event_rows[0].get("property_id"):
        property_ids.append(event_rows[0]["property_id"])

    titles: dict[str, str] = {}
    if property_ids:
        rows = (
            client.table("properties")
            .select("id,title")
            .eq("tenant_id", tid)
            .in_("id", list(dict.fromkeys(property_ids)))
            .execute()
            .data
            or []
        )
        titles = {row["id"]: row.get("title") or "" for row in rows}

    # --- conversation state ---
    convo_rows = (
        client.table("client_conversations")
        .select("id,status,last_inbound_at,last_message_at,archived_at")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .neq("status", "closed")
        .is_("archived_at", "null")
        .order("last_message_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    conversation_id = convo_rows[0]["id"] if convo_rows else None
    awaiting_reply = False
    if convo_rows:
        inbound = convo_rows[0].get("last_inbound_at")
        last = convo_rows[0].get("last_message_at")
        awaiting_reply = bool(inbound) and (not last or inbound >= last)

    open_tasks = (
        client.table("tasks")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .in_("status", list(_OPEN_TASK_STATUSES))
        .contains("related", {"contacts": [cid]})
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
        .count
        or 0
    )

    note_count = (
        client.table("note_targets")
        .select("id", count="exact")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .limit(1)
        .execute()
        .count
        or 0
    )

    counts = OverviewCounts(
        interactions=len(interaction_ids),
        deals=len(deal_rows),
        notes=note_count,
        documents=_count("document_assignments", tenant_id, "contact_id", cid, soft_delete=False),
        emails=_count("email_threads", tenant_id, "contact_id", cid),
        open_tasks=open_tasks,
    )

    return ContactOverview(
        last_interaction_at=last_interaction_at,
        last_interaction_kind=last_interaction_kind,
        next_event=(
            OverviewEvent(
                id=event_rows[0]["id"],
                kind=event_rows[0].get("kind"),
                title=event_rows[0].get("title"),
                starts_at=event_rows[0]["starts_at"],
                location=event_rows[0].get("location"),
                property_title=titles.get(event_rows[0].get("property_id") or ""),
            )
            if event_rows
            else None
        ),
        deals=[
            OverviewDeal(
                id=row["id"],
                pipeline_stage=row.get("pipeline_stage"),
                property_id=row.get("property_id"),
                property_title=titles.get(row.get("property_id") or ""),
                expected_value_cents=row.get("expected_value_cents"),
                currency=row.get("currency"),
            )
            for row in deal_rows
        ],
        properties=[
            OverviewProperty(id=pid, title=titles.get(pid) or "Sin título") for pid in dict.fromkeys(property_ids)
        ],
        conversation_id=conversation_id,
        awaiting_reply=awaiting_reply,
        counts=counts,
    )
