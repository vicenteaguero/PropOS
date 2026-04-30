from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class PropertyStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    INACTIVE = "INACTIVE"


class PropertyBase(BaseModel):
    title: str
    address: str | None = None
    status: PropertyStatus = PropertyStatus.AVAILABLE
    is_draft: bool = False


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    title: str | None = None
    address: str | None = None
    status: PropertyStatus | None = None
    is_draft: bool | None = None


class PropertyResponse(PropertyBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
