from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CampaignChannel(str, Enum):
    META = "META"
    GOOGLE = "GOOGLE"
    PORTAL = "PORTAL"
    EMAIL = "EMAIL"
    OFFLINE = "OFFLINE"
    OTHER = "OTHER"


class CampaignStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CampaignBase(BaseModel):
    name: str
    channel: CampaignChannel
    status: CampaignStatus = CampaignStatus.DRAFT
    start_at: datetime | None = None
    end_at: datetime | None = None
    budget_cents: int | None = None
    currency: str = "CLP"
    external_id: str | None = None
    related: dict[str, Any] = {}
    notes: str | None = None
    metadata: dict[str, Any] = {}


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: str | None = None
    channel: CampaignChannel | None = None
    status: CampaignStatus | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    budget_cents: int | None = None
    external_id: str | None = None
    related: dict[str, Any] | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class CampaignResponse(CampaignBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AdBase(BaseModel):
    name: str
    external_id: str | None = None
    spend_cents: int = 0
    impressions: int = 0
    clicks: int = 0
    leads_count: int = 0
    metadata: dict[str, Any] = {}


class AdCreate(AdBase):
    campaign_id: UUID


class AdUpdate(BaseModel):
    name: str | None = None
    external_id: str | None = None
    spend_cents: int | None = None
    impressions: int | None = None
    clicks: int | None = None
    leads_count: int | None = None
    metadata: dict[str, Any] | None = None


class AdResponse(AdBase):
    id: UUID
    tenant_id: UUID
    campaign_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
