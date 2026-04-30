from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class OpportunityStatus(str, Enum):
    OPEN = "OPEN"
    WON = "WON"
    LOST = "LOST"


class OpportunityBase(BaseModel):
    pipeline_id: UUID | None = None
    person_id: UUID | None = None
    property_id: UUID | None = None
    project_id: UUID | None = None
    pipeline_stage: str = "LEAD"
    status: OpportunityStatus = OpportunityStatus.OPEN
    expected_close_at: date | None = None
    expected_value_cents: int | None = None
    currency: str = "CLP"
    probability: int | None = None
    lost_reason: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    pipeline_id: UUID | None = None
    person_id: UUID | None = None
    property_id: UUID | None = None
    project_id: UUID | None = None
    pipeline_stage: str | None = None
    status: OpportunityStatus | None = None
    expected_close_at: date | None = None
    expected_value_cents: int | None = None
    probability: int | None = None
    lost_reason: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class OpportunityResponse(OpportunityBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None

    model_config = {"from_attributes": True}


class StageHistoryResponse(BaseModel):
    id: UUID
    opportunity_id: UUID
    from_stage: str | None = None
    to_stage: str
    note: str | None = None
    changed_by: UUID | None = None
    changed_at: datetime

    model_config = {"from_attributes": True}
