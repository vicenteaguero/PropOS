from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TagBase(BaseModel):
    name: str
    color: str | None = None


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class TagResponse(TagBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TaggingCreate(BaseModel):
    tag_id: UUID
    target_table: str
    target_row_id: UUID


class TaggingResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tag_id: UUID
    target_table: str
    target_row_id: UUID
    created_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
