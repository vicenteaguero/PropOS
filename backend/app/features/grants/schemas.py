from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.features.memberships.schemas import UserView


class PropertyGrantBase(BaseModel):
    user_id: UUID
    property_id: UUID
    tenant_id: UUID
    view: UserView = UserView.OWNER
    capabilities: list[str] = []


class PropertyGrantCreate(PropertyGrantBase):
    pass


class PropertyGrantUpdate(BaseModel):
    view: UserView | None = None
    capabilities: list[str] | None = None


class PropertyGrantResponse(PropertyGrantBase):
    id: UUID
    granted_by: UUID | None = None
    property_title: str | None = None
    property_address: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
