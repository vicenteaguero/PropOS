"""The queue of everything waiting on a person, in one ranked list.

A brokerage does not lose deals because a record is missing; it loses them
because a message sat unread past the 24-hour WhatsApp window, a visit went
unconfirmed, or a deal nobody touched for a month quietly went cold. Each of
those lives in a different table, and until now each had its own screen — so
"who needs me right now" was a question the product could not answer without
the broker opening five tabs and comparing timestamps by eye.

This reads the five sources, gives every row a reason in Spanish and an
urgency, and returns them in the order a person should work them.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Callable
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_thread_client
from app.features.attention.schemas import AttentionFeed, AttentionItem, AttentionKind, Urgency

#: Per-source scan ceiling. Past any real tenant's open work, and it keeps one
#: pathological workspace from turning this into a full table scan.
_SCAN_LIMIT = 500

#: Ceiling for the name/title maps, which cover the whole tenant rather than
#: one source's open work.
_LOOKUP_LIMIT = 5000

#: WhatsApp only allows free-form replies within 24 h of the contact's last
#: message. After that a reply needs an approved template, which is slower and
#: costs money — so the closing window is the single most urgent thing here.
_FREEFORM_HOURS = 24
_WINDOW_WARN_HOURS = 20

#: Past this, a thread stopped being a reply we owe and became a lead we lost.
#: It stays in the queue — at the bottom, where re-opening it is a choice.
_ABANDONED_HOURS = 24 * 7

#: An open deal nobody has touched in this long has gone quiet on its own.
_STALL_DAYS = 14
_COLD_DAYS = 30

_OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "BLOCKED")

_URGENCY_RANK = {Urgency.NOW: 0, Urgency.TODAY: 1, Urgency.SOON: 2}


def _client():
    # Thread-local: every reader below runs inside `asyncio.to_thread`, and the
    # shared client's HTTP/2 connection cannot be used by two threads at once.
    return get_thread_client()


def _labels(table: str, tenant_id: UUID, select: str, ids: list[str]) -> dict[str, str]:
    """Resolve exactly the ids the queue references, and nothing else.

    This used to read the tenant's WHOLE contacts and properties tables — up to
    `_LOOKUP_LIMIT` rows each — before any source had run, purely so a title
    could say a name instead of an id. On a tenant of a few thousand people
    that is megabytes of JSON per open of the home screen, to label perhaps
    thirty rows. `contacts` alone showed 261k tuples read across 1,071
    sequential scans in five days, which is that map, fetched over and over.

    Resolving after the fact costs one extra wave but reads ~30 rows.
    """
    if not ids:
        return {}
    key, label = select.split(",", 1)
    rows = (
        _client()
        .table(table)
        .select(select)
        .eq("tenant_id", str(tenant_id))
        .in_(key, ids)
        .is_("deleted_at", "null")
        .limit(_LOOKUP_LIMIT)
        .execute()
        .data
        or []
    )
    return {row[key]: row[label] for row in rows if row.get(label)}


def _parse(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)


def _humanize(delta: dt.timedelta) -> str:
    """ "hace 3 h" / "hace 2 días" — the tail of a Spanish sentence, lowercase."""
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"hace {max(minutes, 1)} min"
    hours = minutes // 60
    if hours < 24:
        return f"hace {hours} h"
    days = hours // 24
    if days < 30:
        return f"hace {days} día{'s' if days != 1 else ''}"
    months = days // 30
    return f"hace {months} mes{'es' if months != 1 else ''}"


def _unanswered(tenant_id: UUID, now: dt.datetime):
    rows = (
        _client()
        .table("client_conversations")
        .select("id,contact_id,external_phone_e164,status,last_inbound_at,last_message_at,metadata")
        .eq("tenant_id", str(tenant_id))
        .neq("status", "closed")
        .is_("archived_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
        or []
    )
    for row in rows:
        inbound = _parse(row.get("last_inbound_at"))
        last = _parse(row.get("last_message_at"))
        # Waiting on us only when the contact spoke last. `>=` because a seeded
        # or imported thread can carry the same stamp on both columns.
        if not inbound or (last and inbound < last):
            continue
        age = now - inbound
        hours = age.total_seconds() / 3600
        # Urgency tracks the free-form window, not raw age. A message from four
        # months ago is abandoned, not urgent: ranking it above a visit starting
        # in an hour is exactly how a queue becomes noise nobody reads.
        # The reason says WHY this is here, never how long ago it arrived: the
        # row prints `at` as a timestamp of its own, so "Sin responder hace 6
        # días" next to "Sábado" was the same fact twice — and the longer of the
        # two, which shoved the property (the thing a broker actually
        # recognises) out of the row. A countdown is different information and
        # stays.
        if hours >= _ABANDONED_HOURS:
            urgency, reason = Urgency.SOON, "Sin responder"
        elif hours >= _FREEFORM_HOURS:
            urgency, reason = Urgency.TODAY, "Requiere plantilla"
        elif hours >= _WINDOW_WARN_HOURS:
            # Minutes in the last hour. `int()` on the remaining hours floors to
            # "Quedan 0 h de ventana" for everything under sixty minutes — a
            # countdown that reads as expired, printed on the single most urgent
            # row in the queue, where the number is the whole point.
            left_min = int((_FREEFORM_HOURS - hours) * 60)
            reason = f"Quedan {left_min} min de ventana" if left_min < 60 else f"Quedan {left_min // 60} h de ventana"
            urgency = Urgency.NOW
        elif hours >= 4:
            urgency, reason = Urgency.TODAY, "Sin responder"
        else:
            urgency, reason = Urgency.SOON, "Sin responder"

        contact_id = row.get("contact_id")
        meta = row.get("metadata") or {}
        property_id = meta.get("property_id") if isinstance(meta, dict) else None
        yield AttentionItem(
            id=f"unanswered:{row['id']}",
            kind=AttentionKind.UNANSWERED,
            urgency=urgency,
            title=row.get("external_phone_e164") or "Sin nombre",
            subtitle=None,
            reason=reason,
            at=inbound,
            deadline=inbound + dt.timedelta(hours=_FREEFORM_HOURS),
            contact_id=contact_id,
            property_id=property_id,
            conversation_id=row["id"],
        )


def _email_waiting(tenant_id: UUID, now: dt.datetime):
    """Open e-mail threads where the counterpart spoke last.

    This used to batch-read `email_messages` to work out the direction of the
    last message, because `email_threads` carried no inbound timestamp — which
    is also why the inbox hardcoded `needsReply: false` for the whole e-mail
    channel. A trigger now maintains `waiting_on` and `last_inbound_at`, so the
    question is a column and an index instead of a second query and a guess.
    """
    rows = (
        _client()
        .table("email_threads")
        .select("id,subject,counterpart_name,counterpart_email,contact_id,last_inbound_at,portal,is_lead")
        .eq("tenant_id", str(tenant_id))
        .eq("status", "OPEN")
        .eq("waiting_on", "us")
        .is_("deleted_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
        or []
    )

    for row in rows:
        at = _parse(row.get("last_inbound_at"))
        age = now - at if at else dt.timedelta()
        hours = age.total_seconds() / 3600
        is_lead = bool(row.get("is_lead"))
        portal = row.get("portal")

        if hours >= _ABANDONED_HOURS:
            urgency = Urgency.SOON
        elif hours >= 24:
            urgency = Urgency.TODAY
        else:
            urgency = Urgency.NOW if is_lead else Urgency.TODAY

        if is_lead:
            kind = AttentionKind.LEAD
            reason = f"Lead de {portal or 'portal'}"
        else:
            kind = AttentionKind.UNANSWERED
            reason = "Sin responder"

        contact_id = row.get("contact_id")
        yield AttentionItem(
            id=f"{kind.value}:{row['id']}",
            kind=kind,
            urgency=urgency,
            title=row.get("counterpart_name") or row.get("counterpart_email") or "Sin remitente",
            subtitle=row.get("subject"),
            reason=reason,
            at=at,
            # A portal sends the same enquiry to every broker with the listing,
            # so the first reply usually wins it.
            deadline=(at + dt.timedelta(hours=_FREEFORM_HOURS)) if at else None,
            contact_id=contact_id,
            thread_id=row["id"],
        )


def _visits(tenant_id: UUID, now: dt.datetime):
    horizon = now + dt.timedelta(hours=36)
    rows = (
        _client()
        .table("events")
        .select("id,kind,title,starts_at,location,property_id,contact_id,status")
        .eq("tenant_id", str(tenant_id))
        .eq("status", "SCHEDULED")
        .gte("starts_at", now.isoformat())
        .lte("starts_at", horizon.isoformat())
        .is_("deleted_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
        or []
    )
    today = now.date()
    for row in rows:
        at = _parse(row.get("starts_at"))
        if not at:
            continue
        hours = (at - now).total_seconds() / 3600
        if hours <= 3:
            urgency = Urgency.NOW
        elif at.date() == today:
            urgency = Urgency.TODAY
        else:
            urgency = Urgency.SOON
        contact_id = row.get("contact_id")
        property_id = row.get("property_id")
        when = at.astimezone().strftime("%H:%M")
        label = "Visita" if row.get("kind") == "VISIT" else "Agendado"
        yield AttentionItem(
            id=f"visit:{row['id']}",
            kind=AttentionKind.VISIT,
            urgency=urgency,
            title=row.get("title") or "Sin contacto",
            subtitle=row.get("location"),
            reason=f"{label} {'hoy' if at.date() == today else 'mañana'} a las {when}",
            at=at,
            deadline=at,
            contact_id=contact_id,
            property_id=property_id,
            event_id=row["id"],
        )


def _tasks(tenant_id: UUID, now: dt.datetime, listed_events: set[str]):
    rows = (
        _client()
        .table("tasks")
        .select("id,title,status,priority,due_at,related")
        .eq("tenant_id", str(tenant_id))
        .in_("status", list(_OPEN_TASK_STATUSES))
        .not_.is_("due_at", "null")
        .lte("due_at", (now + dt.timedelta(days=1)).isoformat())
        .is_("deleted_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
        or []
    )
    for row in rows:
        due = _parse(row.get("due_at"))
        if not due:
            continue
        related = row.get("related") or {}
        related_events = related.get("events") or [] if isinstance(related, dict) else []
        # One item per real-world thing. The seeded "Preparar: Visita — …" task
        # and the visit itself are the same appointment; listing both doubles
        # the queue and makes the duplicate look like two obligations.
        if any(event_id in listed_events for event_id in related_events):
            continue
        related_properties = related.get("properties") or [] if isinstance(related, dict) else []
        # Was "first related property that exists in the tenant map"; without
        # the whole-tenant map, take the first and let _resolve_labels decide
        # whether it names anything.
        property_id = related_properties[0] if related_properties else None
        late = now - due
        # Same abandonment rule as an unanswered thread: something two months
        # past due is a backlog item, not an emergency, and letting it sit in
        # "Ahora" pushes today's real work off the top of the queue.
        if late.total_seconds() <= 0:
            urgency = Urgency.TODAY
            reason = "Vence hoy" if due.date() == now.date() else "Vence mañana"
        elif late.total_seconds() >= _ABANDONED_HOURS * 3600:
            urgency, reason = Urgency.SOON, f"Vencida {_humanize(late)}"
        else:
            urgency, reason = Urgency.NOW, f"Vencida {_humanize(late)}"
        yield AttentionItem(
            id=f"task:{row['id']}",
            kind=AttentionKind.TASK,
            urgency=urgency,
            title=row.get("title") or "Tarea sin título",
            subtitle=None,
            reason=reason,
            at=due,
            deadline=due,
            property_id=property_id,
            task_id=row["id"],
        )


def _stalled(tenant_id: UUID, now: dt.datetime):
    cutoff = now - dt.timedelta(days=_STALL_DAYS)
    rows = (
        _client()
        .table("opportunities")
        .select("id,person_id,property_id,pipeline_stage,updated_at,expected_value_cents,currency")
        .eq("tenant_id", str(tenant_id))
        .eq("status", "OPEN")
        .lte("updated_at", cutoff.isoformat())
        .is_("deleted_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
        or []
    )
    for row in rows:
        touched = _parse(row.get("updated_at"))
        if not touched:
            continue
        age = now - touched
        urgency = Urgency.TODAY if age.days >= _COLD_DAYS else Urgency.SOON
        person_id = row.get("person_id")
        property_id = row.get("property_id")
        yield AttentionItem(
            id=f"stalled:{row['id']}",
            kind=AttentionKind.STALLED,
            urgency=urgency,
            title="Negocio sin contacto",
            subtitle=None,
            reason=f"Sin movimiento {_humanize(age)}",
            at=touched,
            contact_id=person_id,
            property_id=property_id,
            opportunity_id=row["id"],
        )


def rank(items: list[AttentionItem], now: dt.datetime) -> None:
    """Order the queue in place: urgency, then time left before it is too late.

    Sorting by `at` instead would rank a task that went overdue yesterday above
    a visit starting in an hour, because a past timestamp is a smaller number
    than a future one. Everything already blown collapses to the same 0 and
    then sorts most-overdue-first; an item with no deadline — a deal going
    quiet — sits at the end of its bucket, where re-opening it is a choice.
    """

    def sort_key(item: AttentionItem) -> tuple[int, float, float]:
        if item.deadline is None:
            return (_URGENCY_RANK[item.urgency], float("inf"), 0.0)
        remaining = (item.deadline - now).total_seconds()
        return (_URGENCY_RANK[item.urgency], max(remaining, 0.0), remaining)

    items.sort(key=sort_key)


async def _gather(*calls: Callable[[], Any]) -> list[Any]:
    """Run blocking PostgREST calls at the same time, off the event loop.

    The Supabase client is synchronous, so a handler that awaits nothing still
    blocks the whole worker for as long as every round trip it makes — and this
    one reads seven tables. Run end to end that is seven network latencies
    stacked up before the first row reaches the broker; in three waves it is
    three, and unrelated requests keep getting served in between.
    """
    return list(await asyncio.gather(*(asyncio.to_thread(call) for call in calls)))


async def _resolve_labels(items: list[AttentionItem], tenant_id: UUID) -> None:
    """Name the people and properties the queue points at, in place.

    A person's name always wins the title, and a property's title always wins
    the subtitle — the same precedence the sources used to apply themselves
    while holding a map of the whole tenant. Anything that does not resolve
    keeps the fallback the row carried (a phone number, an e-mail address, the
    event's own title), which is what the map produced on a miss anyway.
    """
    contact_ids = sorted({item.contact_id for item in items if item.contact_id})
    property_ids = sorted({item.property_id for item in items if item.property_id})
    if not contact_ids and not property_ids:
        return

    names, props = await _gather(
        lambda: _labels("contacts", tenant_id, "id,full_name", contact_ids),
        lambda: _labels("properties", tenant_id, "id,title", property_ids),
    )
    for item in items:
        if item.contact_id and (name := names.get(item.contact_id)):
            item.title = name
        if item.property_id and (title := props.get(item.property_id)):
            item.subtitle = title


async def build_feed(
    tenant_id: UUID,
    limit: int,
    *,
    now: dt.datetime | None = None,
    kinds: set[AttentionKind] | None = None,
) -> AttentionFeed:
    """Rank the queue, optionally narrowed to some kinds.

    `counts` always reports every kind, filtered or not: the caller uses it to
    label the filter that would widen the view, and a count that changes with
    the filter cannot do that.
    """
    now = now or dt.datetime.now(dt.UTC)

    # The four independent sources go first and at the same time. The wave that
    # used to precede them — reading the tenant's entire contacts and properties
    # tables to build a name map — is gone; labels are resolved at the end, for
    # the handful of ids the queue actually references.
    unanswered, emails, visits, stalled = await _gather(
        lambda: list(_unanswered(tenant_id, now)),
        lambda: list(_email_waiting(tenant_id, now)),
        lambda: list(_visits(tenant_id, now)),
        lambda: list(_stalled(tenant_id, now)),
    )

    # Tasks come after because they are deduplicated against the visits already
    # listed: the seeded "Preparar: Visita — …" task and the visit itself are
    # the same appointment.
    listed_events = {item.event_id for item in visits if item.event_id}
    (tasks,) = await _gather(lambda: list(_tasks(tenant_id, now, listed_events)))

    items: list[AttentionItem] = [*unanswered, *emails, *visits, *tasks, *stalled]
    await _resolve_labels(items, tenant_id)

    counts: dict[str, int] = {kind.value: 0 for kind in AttentionKind}
    for item in items:
        counts[item.kind.value] += 1

    rank(items, now)
    shown = [item for item in items if kinds is None or item.kind in kinds]
    return AttentionFeed(items=shown[:limit], counts=counts, total=len(shown))
