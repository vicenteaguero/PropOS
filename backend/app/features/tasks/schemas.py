from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.features.notes.schemas import NoteAttachment


class TaskKind(str, Enum):
    TODO = "TODO"
    PENDING = "PENDING"
    GOAL = "GOAL"
    OBJECTIVE = "OBJECTIVE"
    PLAN = "PLAN"


class TaskStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class TaskBase(BaseModel):
    kind: TaskKind = TaskKind.TODO
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.OPEN
    priority: int = 0
    due_at: datetime | None = None
    parent_task_id: UUID | None = None
    owner_user: UUID | None = None
    related: dict[str, Any] = {}


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    kind: TaskKind | None = None
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: int | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    parent_task_id: UUID | None = None
    owner_user: UUID | None = None
    related: dict[str, Any] | None = None


class TaskResponse(TaskBase):
    id: UUID
    tenant_id: UUID
    # Names for the ids in `related`, resolved server-side. Without this the
    # client would join against the capped entity endpoints.
    related_labels: dict[str, Any] = {}
    # Photos and voice memos, same `media_assets` rows notes use.
    attachments: list[NoteAttachment] = []
    completed_at: datetime | None = None
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
