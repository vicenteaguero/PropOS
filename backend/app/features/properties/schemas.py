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
    # Signed `card` derivative of the property's first photo. Present on list
    # responses so the grid can render a real image without one request per row;
    # None when the property has no photos.
    cover_url: str | None = None
    # Where each fact came from: {"area_sqm": {"src": "declared"}, …}. A missing
    # key means nobody recorded it, which is the honest state for everything
    # entered before this existed. The agent guard reads it before quoting a
    # figure as fact, and the property page marks the ones nobody checked.
    provenance: dict[str, Any] = {}
    building_id: UUID | None = None
    unit_label: str | None = None

    model_config = {"from_attributes": True}


class GenerateDescriptionRequest(BaseModel):
    tone: str = "profesional"
    portal: str = "generic"
    max_words: int = 180


class GeneratedDescription(BaseModel):
    title_suggestion: str
    description: str
    highlights: list[str] = []


class PropertyPhoto(BaseModel):
    """A `media_assets` link rendered for display. `url` is signed and short-lived."""

    id: UUID
    media_file_id: UUID
    url: str
    # WebP derivatives (~400px / ~800px long edge). Both fall back to `url` when
    # the photo predates derivative generation and has not been backfilled.
    thumb_url: str = ""
    card_url: str = ""
    role: str = "PHOTO"
    position: int = 0
    title: str | None = None
    created_at: datetime | None = None
