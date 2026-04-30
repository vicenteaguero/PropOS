from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class PublicationStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    EXPIRED = "EXPIRED"
    REMOVED = "REMOVED"


class PublicationBase(BaseModel):
    property_id: UUID
    portal_org_id: UUID
    external_url: str | None = None
    external_id: str | None = None
    status: PublicationStatus = PublicationStatus.DRAFT
    listed_at: datetime | None = None
    removed_at: datetime | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}


class PublicationCreate(PublicationBase):
    pass


class PublicationUpdate(BaseModel):
    external_url: str | None = None
    external_id: str | None = None
    status: PublicationStatus | None = None
    listed_at: datetime | None = None
    removed_at: datetime | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class PublicationResponse(PublicationBase):
    id: UUID
    tenant_id: UUID
    view_count_external: int = 0
    inquiries_count: int = 0
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
