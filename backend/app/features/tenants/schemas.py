from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TenantSettings(BaseModel):
    ai_assistant_name: str = "Anita"
    default_paper_size: str = "A4"


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    settings: TenantSettings


class TenantAdminResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime | None = None
    member_count: int = 0
    property_count: int = 0


class TenantCreate(BaseModel):
    name: str = Field(min_length=1)
    slug: str = Field(min_length=2, pattern=r"^[a-z0-9][a-z0-9-]*$")


class TenantUpdate(BaseModel):
    name: str | None = None
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]*$")
    is_active: bool | None = None


class TenantSettingsUpdate(BaseModel):
    ai_assistant_name: str | None = None
    default_paper_size: str | None = None
    extra: dict[str, Any] | None = None
