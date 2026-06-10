from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class PropertyStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    INACTIVE = "INACTIVE"


class ListingKind(str, Enum):
    SALE = "SALE"
    RENT = "RENT"
    LEASE = "LEASE"


class PropertyBase(BaseModel):
    title: str
    address: str | None = None
    status: PropertyStatus = PropertyStatus.AVAILABLE
    is_draft: bool = False
    description: str | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    area_sqm: float | None = None
    lot_sqm: float | None = None
    list_price_cents: int | None = None
    currency: str = "CLP"
    listing_kind: ListingKind = ListingKind.SALE
    lat: float | None = None
    lng: float | None = None
    year_built: int | None = None
    project_id: UUID | None = None
    metadata: dict[str, Any] = {}


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    title: str | None = None
    address: str | None = None
    status: PropertyStatus | None = None
    is_draft: bool | None = None
    description: str | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    area_sqm: float | None = None
    lot_sqm: float | None = None
    list_price_cents: int | None = None
    currency: str | None = None
    listing_kind: ListingKind | None = None
    lat: float | None = None
    lng: float | None = None
    year_built: int | None = None
    project_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class PropertyResponse(PropertyBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerateDescriptionRequest(BaseModel):
    tone: str = "profesional"
    portal: str = "generic"
    max_words: int = 180


class GeneratedDescription(BaseModel):
    title_suggestion: str
    description: str
    highlights: list[str] = []
