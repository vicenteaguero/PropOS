from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class ReminderTargetTable(str, Enum):
    EVENTS = "events"
    TASKS = "tasks"
    TRANSACTIONS = "transactions"


class ReminderCreate(BaseModel):
    target_table: ReminderTargetTable
    target_row_id: UUID
    remind_at: datetime
    message: str | None = None
    url: str | None = None
    # Defaults to the creating user when omitted.
    user_id: UUID | None = None


class ReminderResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    target_table: str
    target_row_id: UUID
    user_id: UUID
    remind_at: datetime
    channel: str
    message: str | None = None
    url: str | None = None
    status: str
    sent_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
