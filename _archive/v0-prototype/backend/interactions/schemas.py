from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class InteractionBase(BaseModel):
    notes: str | None = None
    user_id: UUID | None = None
    contact_id: UUID | None = None
    property_id: UUID | None = None


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    notes: str | None = None
    user_id: UUID | None = None
    contact_id: UUID | None = None
    property_id: UUID | None = None


class InteractionResponse(InteractionBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
