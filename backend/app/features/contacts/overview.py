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

import asyncio
import datetime as dt
from collections.abc import Callable
from typing import Any
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


async def _gather(*calls: Callable[[], Any]) -> list[Any]:
    """Run blocking PostgREST calls at the same time, off the event loop.

    The Supabase client is synchronous, so a handler that awaits nothing still
    blocks the whole worker for as long as every round trip it makes — and this
    endpoint makes eight. Sequentially that is eight network latencies stacked
    end to end: ~8 s from a laptop in Chile, and on Cloud Run enough to hold the
    loop while unrelated requests queue behind it. Threaded and gathered, it
    costs one.
    """
    return list(await asyncio.gather(*(asyncio.to_thread(call) for call in calls)))


async def build_overview(tenant_id: UUID, contact_id: UUID) -> ContactOverview:
    tid, cid = str(tenant_id), str(contact_id)
    now = dt.datetime.now(dt.UTC)
    client = _client()

    def participants():
        return (
            client.table("interaction_participants")
            .select("interaction_id")
            .eq("tenant_id", tid)
            .eq("person_id", cid)
            .limit(_LIMIT)
            .execute()
            .data
            or []
        )

    def open_deals():
        return (
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

    def next_event():
        return (
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

    def live_conversation():
        return (
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

    def open_tasks() -> int:
        return (
            client.table("tasks")
            .select("id", count="exact")
            # `related` is {"<table>": [ids]} — the same shape tasks already use
            # for the properties and events they belong to.
            .contains("related", {"contacts": [cid]})
            .eq("tenant_id", tid)
            .in_("status", list(_OPEN_TASK_STATUSES))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
            .count
            or 0
        )

    def counted(table: str, column: str, *, soft_delete: bool = True) -> Callable[[], int]:
        def run() -> int:
            q = client.table(table).select("id", count="exact").eq("tenant_id", tid).eq(column, cid)
            if soft_delete:
                q = q.is_("deleted_at", "null")
            return q.limit(1).execute().count or 0

        return run

    (
        participant_rows,
        deal_rows,
        event_rows,
        convo_rows,
        task_count,
        note_count,
        document_count,
        email_count,
    ) = await _gather(
        participants,
        open_deals,
        next_event,
        live_conversation,
        open_tasks,
        counted("note_targets", "contact_id", soft_delete=False),
        counted("document_assignments", "contact_id", soft_delete=False),
        counted("email_threads", "contact_id"),
    )

    interaction_ids = [row["interaction_id"] for row in participant_rows if row.get("interaction_id")]
    property_ids = [row["property_id"] for row in deal_rows if row.get("property_id")]
    if event_rows and event_rows[0].get("property_id"):
        property_ids.append(event_rows[0]["property_id"])

    # Second round: both of these need ids the first round produced.
    def latest_interaction():
        if not interaction_ids:
            return []
        return (
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

    def property_titles():
        if not property_ids:
            return []
        return (
            client.table("properties")
            .select("id,title")
            .eq("tenant_id", tid)
            .in_("id", list(dict.fromkeys(property_ids)))
            .execute()
            .data
            or []
        )

    latest, title_rows = await _gather(latest_interaction, property_titles)
    titles = {row["id"]: row.get("title") or "" for row in title_rows}

    conversation_id = convo_rows[0]["id"] if convo_rows else None
    awaiting_reply = False
    if convo_rows:
        inbound = convo_rows[0].get("last_inbound_at")
        last = convo_rows[0].get("last_message_at")
        awaiting_reply = bool(inbound) and (not last or inbound >= last)

    return ContactOverview(
        last_interaction_at=latest[0].get("occurred_at") if latest else None,
        last_interaction_kind=latest[0].get("kind") if latest else None,
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
        counts=OverviewCounts(
            interactions=len(interaction_ids),
            deals=len(deal_rows),
            notes=note_count,
            documents=document_count,
            emails=email_count,
            open_tasks=task_count,
        ),
    )
