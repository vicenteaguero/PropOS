from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.features.properties.constants import PropertyStatus


class PropertyBase(BaseModel):
    title: str
    description: str | None = None
    status: PropertyStatus = PropertyStatus.AVAILABLE
    address: str | None = None
    surface_m2: float | None = None
    landowner_id: UUID | None = None


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: PropertyStatus | None = None
    address: str | None = None
    surface_m2: float | None = None
    landowner_id: UUID | None = None


class PropertyResponse(PropertyBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)
