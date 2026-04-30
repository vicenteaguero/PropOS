from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr


class OrganizationKind(str, Enum):
    NOTARY = "NOTARY"
    PORTAL = "PORTAL"
    GOV = "GOV"
    BANK = "BANK"
    AGENCY = "AGENCY"
    BROKERAGE = "BROKERAGE"
    CONTRACTOR = "CONTRACTOR"
    SUPPLIER = "SUPPLIER"
    OTHER = "OTHER"


class OrganizationBase(BaseModel):
    name: str
    kind: OrganizationKind = OrganizationKind.OTHER
    rut: str | None = None
    website: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = None
    kind: OrganizationKind | None = None
    rut: str | None = None
    website: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None


class OrganizationResponse(OrganizationBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
