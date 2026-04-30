from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class PlaceBase(BaseModel):
    name: str
    address: str | None = None
    city: str | None = None
    region: str | None = None
    country: str = "CL"
    lat: float | None = None
    lng: float | None = None
    organization_id: UUID | None = None
    metadata: dict[str, Any] = {}


class PlaceCreate(PlaceBase):
    pass


class PlaceUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    organization_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class PlaceResponse(PlaceBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
