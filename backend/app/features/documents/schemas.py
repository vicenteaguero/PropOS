from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentBase(BaseModel):
    filename: str
    storage_path: str
    entity_type: str
    entity_id: UUID


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    filename: str | None = None
    storage_path: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None


class DocumentResponse(DocumentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
