from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints


# `events.kind` stopped being a Postgres enum in 20240601000080: types are a
# per-tenant catalog now, so a broker can add "TASACION" without a deploy. The
# five names below are the seeded system types, kept as constants because the
# scheduler, the seeder and the agent all still reference them by name — but
# `kind` on the wire is a plain string, validated against the shape the column
# enforces rather than against a closed set the server cannot know.
SYSTEM_EVENT_KINDS = ("VISIT", "MEETING", "CALL", "DEADLINE", "OTHER")

EventKindStr = Annotated[str, StringConstraints(pattern=r"^[A-Z][A-Z0-9_]{0,31}$")]


class EventKind(str, Enum):
    """The seeded types. Accepted anywhere `EventKindStr` is, and no longer exhaustive."""

    VISIT = "VISIT"
    MEETING = "MEETING"
    CALL = "CALL"
    DEADLINE = "DEADLINE"
    OTHER = "OTHER"


class EventStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class EventBase(BaseModel):
    kind: EventKindStr = "OTHER"
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    all_day: bool = False
    location: str | None = None
    status: EventStatus = EventStatus.SCHEDULED
    property_id: UUID | None = None
    contact_id: UUID | None = None
    project_id: UUID | None = None
    opportunity_id: UUID | None = None
    assignee_user: UUID | None = None
    # 0 normal, 1 alta, 2 crítica. Read as well as written: events in the same
    # hour sort by this before they sort by title.
    priority: int = Field(default=0, ge=0, le=2)


class EventCreate(EventBase):
    # When set, a reminder row is created for the current user at this time.
    remind_at: datetime | None = None


class EventUpdate(BaseModel):
    kind: EventKindStr | None = None
    title: str | None = None
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool | None = None
    location: str | None = None
    status: EventStatus | None = None
    property_id: UUID | None = None
    contact_id: UUID | None = None
    project_id: UUID | None = None
    opportunity_id: UUID | None = None
    assignee_user: UUID | None = None
    priority: int | None = Field(default=None, ge=0, le=2)
    # Editing an event used to leave its reminder on the old day: `EventUpdate`
    # had no `remind_at`, so moving a visit from Tuesday to Thursday still rang
    # on Tuesday. `None` leaves the reminder alone; a value replaces it; the
    # sentinel below clears it.
    remind_at: datetime | None = None
    clear_reminder: bool = False


class EventResponse(EventBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarItem(BaseModel):
    tenant_id: UUID
    item_type: str
    id: UUID
    title: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    status: str | None = None
    kind: str | None = None
    property_id: UUID | None = None
    contact_id: UUID | None = None
    amount_cents: int | None = None
    opportunity_id: UUID | None = None
    #: 0 normal, 1 alta, 2 crítica. Carried by the feed since 20240601000083 —
    #: before that the event form could write a priority nothing ever read.
    priority: int | None = None
    # `v_calendar_feed` has carried this since 20240601000070, but the field was
    # never declared here -- and `response_model=list[CalendarItem]` drops every
    # key the model does not name, so the address was stripped from every feed
    # response. That is why the "cómo llegar" button never rendered on Home.
    location: str | None = None


class EventTypeBase(BaseModel):
    """A row of the per-tenant event catalog."""

    key: EventKindStr
    label: str
    # A name from the fixed categorical palette, never a hex and never the
    # tenant accent -- see `shared/ui/event-palette.ts`.
    color: str = "slate"
    icon: str | None = None
    behavior: Literal["visit", "meeting", "call", "deadline", "other"] = "other"
    position: int = 0
    active: bool = True


class EventTypeCreate(EventTypeBase):
    pass


class EventTypeUpdate(BaseModel):
    # `key` is absent on purpose: renaming it would orphan every event already
    # filed under it, because `events.kind` carries the key and not an id.
    label: str | None = None
    color: str | None = None
    icon: str | None = None
    behavior: Literal["visit", "meeting", "call", "deadline", "other"] | None = None
    position: int | None = None
    active: bool | None = None


class EventTypeResponse(EventTypeBase):
    id: UUID
    tenant_id: UUID
    is_system: bool = False

    model_config = {"from_attributes": True}
