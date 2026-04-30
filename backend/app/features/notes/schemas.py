from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NoteBase(BaseModel):
    body: str
    target_table: str | None = None
    target_row_id: UUID | None = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    body: str | None = None


class NoteResponse(NoteBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
