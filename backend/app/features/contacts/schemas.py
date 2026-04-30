from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ContactType(str, Enum):
    BUYER = "BUYER"
    SELLER = "SELLER"
    LANDOWNER = "LANDOWNER"
    NOTARY = "NOTARY"
    INVESTOR = "INVESTOR"
    EMPLOYEE = "EMPLOYEE"
    FAMILY = "FAMILY"
    VENDOR = "VENDOR"
    STAKEHOLDER = "STAKEHOLDER"
    OTHER = "OTHER"


class ContactBase(BaseModel):
    full_name: str
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType = ContactType.OTHER
    rut: str | None = None
    birthdate: date | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}
    is_draft: bool = False


class ContactCreate(ContactBase):
    aliases: list[str] = []


class ContactUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType | None = None
    rut: str | None = None
    birthdate: date | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None
    is_draft: bool | None = None


class ContactResponse(ContactBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    merged_into_id: UUID | None = None

    model_config = {"from_attributes": True}


class PersonAliasCreate(BaseModel):
    person_id: UUID
    alias: str


class PersonAliasResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    person_id: UUID
    alias: str
    created_at: datetime

    model_config = {"from_attributes": True}
