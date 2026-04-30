from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InternalAreaBase(BaseModel):
    name: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$", min_length=2, max_length=50)


class InternalAreaCreate(InternalAreaBase):
    pass


class InternalAreaUpdate(BaseModel):
    name: str | None = None
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9-]+$", min_length=2, max_length=50)


class InternalAreaResponse(InternalAreaBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
