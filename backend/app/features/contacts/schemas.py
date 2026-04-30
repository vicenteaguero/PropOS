from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ContactType(str, Enum):
    BUYER = "BUYER"
    SELLER = "SELLER"
    LANDOWNER = "LANDOWNER"
    NOTARY = "NOTARY"
    OTHER = "OTHER"


class ContactBase(BaseModel):
    full_name: str
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType = ContactType.OTHER
    is_draft: bool = False


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType | None = None
    is_draft: bool | None = None


class ContactResponse(ContactBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
