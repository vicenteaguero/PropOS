from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class WorkflowStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class WorkflowBase(BaseModel):
    name: str
    scope_table: str | None = None
    scope_row_id: UUID | None = None
    state: WorkflowStatus = WorkflowStatus.NOT_STARTED
    metadata: dict[str, Any] = {}


class WorkflowCreate(WorkflowBase):
    steps: list[str] = []


class WorkflowUpdate(BaseModel):
    name: str | None = None
    state: WorkflowStatus | None = None
    metadata: dict[str, Any] | None = None


class WorkflowResponse(WorkflowBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowStepBase(BaseModel):
    name: str
    position: int = 0
    status: WorkflowStatus = WorkflowStatus.NOT_STARTED
    notes: str | None = None


class WorkflowStepCreate(WorkflowStepBase):
    workflow_id: UUID


class WorkflowStepUpdate(BaseModel):
    name: str | None = None
    position: int | None = None
    status: WorkflowStatus | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class WorkflowStepResponse(WorkflowStepBase):
    id: UUID
    workflow_id: UUID
    tenant_id: UUID
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
