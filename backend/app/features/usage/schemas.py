from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class UsageKind(str, Enum):
    PAGE_VIEW = "page_view"
    ACTION = "action"
    SESSION_PING = "session_ping"


class UsageEventIn(BaseModel):
    kind: UsageKind
    #: A canonical route or an action name. Capped because it is an index key,
    #: and because anything longer is a URL somebody forgot to canonicalise.
    key: str = Field(min_length=1, max_length=120)
    meta: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime


class UsageBatch(BaseModel):
    #: One flush of the client buffer. Bounded so a broken loop on a phone
    #: cannot post a megabyte per request.
    events: list[UsageEventIn] = Field(min_length=1, max_length=100)


class UsageDailyRow(BaseModel):
    user_id: UUID
    full_name: str | None = None
    email: str | None = None
    day: date
    page_views: int
    actions: int
    active_minutes: int
    first_seen: datetime | None = None
    last_seen: datetime | None = None


class UsageKeyRow(BaseModel):
    key: str
    kind: UsageKind
    count: int


class UsageSummary(BaseModel):
    days: list[UsageDailyRow]
    top_keys: list[UsageKeyRow]
    #: Estimated Cloud Run cost over the window, from the instance floor.
    cost: dict[str, Any]
