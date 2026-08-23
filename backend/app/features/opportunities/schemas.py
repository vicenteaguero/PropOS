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

    #: How many participants and properties the deal has BEYOND the principal
    #: `person_id` / `property_id` the card already names. `person_id` is only
    #: the main one, so a card showing it alone claimed a two-buyer deal was a
    #: one-buyer deal. Zero on the detail endpoints, which list them in full.
    extra_participants: int = 0
    extra_properties: int = 0
    #: Every comuna this deal touches — the principal property's and each one
    #: in `opportunity_properties`. Resolved by the list endpoint so the board
    #: can filter without fetching the whole property table to build a map.
    comunas: list[str] = []

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
