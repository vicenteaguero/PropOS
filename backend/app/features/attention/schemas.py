from __future__ import annotations

import datetime as dt
from enum import StrEnum

from pydantic import BaseModel


class AttentionKind(StrEnum):
    """Why a row is asking for the broker's time.

    These are the five ways work goes stale in a brokerage. They are kinds, not
    severities: a visit in two hours and a deal untouched for a month both need
    attention, but they need completely different things done to them.
    """

    UNANSWERED = "unanswered"
    LEAD = "lead"
    VISIT = "visit"
    TASK = "task"
    STALLED = "stalled"


class Urgency(StrEnum):
    """When it stops being fixable cheaply."""

    NOW = "now"
    TODAY = "today"
    SOON = "soon"


class AttentionItem(BaseModel):
    #: `"<kind>:<row id>"` — stable across refetches, unique across sources.
    id: str
    kind: AttentionKind
    urgency: Urgency
    #: Who this is about. A person's name wherever one exists.
    title: str
    #: What it is about — the property, the task, the subject line.
    subtitle: str | None = None
    #: One line saying why it surfaced: "Sin responder hace 3 h".
    reason: str
    #: The moment that drives the urgency: when they wrote, when it is due.
    at: dt.datetime | None = None
    #: When this stops being fixable cheaply — the 24 h window closing, the
    #: visit starting, the due date. Null when nothing forces the issue.
    deadline: dt.datetime | None = None

    contact_id: str | None = None
    property_id: str | None = None
    conversation_id: str | None = None
    thread_id: str | None = None
    event_id: str | None = None
    task_id: str | None = None
    opportunity_id: str | None = None


class AttentionFeed(BaseModel):
    items: list[AttentionItem]
    #: Per-kind totals BEFORE the limit, so a filter can show a real count.
    counts: dict[str, int]
    total: int
