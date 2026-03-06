from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.features.contacts.constants import ContactType


class ContactBase(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    type: ContactType = ContactType.BUYER
    metadata: dict[str, Any] | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    type: ContactType | None = None
    metadata: dict[str, Any] | None = None


class ContactResponse(ContactBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
