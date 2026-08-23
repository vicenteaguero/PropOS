from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class EventKind(str, Enum):
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
    kind: EventKind = EventKind.OTHER
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


class EventCreate(EventBase):
    # When set, a reminder row is created for the current user at this time.
    remind_at: datetime | None = None


class EventUpdate(BaseModel):
    kind: EventKind | None = None
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
    # `v_calendar_feed` has carried this since 20240601000070, but the field was
    # never declared here -- and `response_model=list[CalendarItem]` drops every
    # key the model does not name, so the address was stripped from every feed
    # response. That is why the "cómo llegar" button never rendered on Home.
    location: str | None = None
