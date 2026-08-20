from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class TenantSettings(BaseModel):
    ai_assistant_name: str = "Propo"
    default_paper_size: str = "A4"
    # Optional hex brand color (e.g. "#2E6B52"); drives the UI accent per workspace.
    brand_color: str | None = None
    # 0-12: how much of the brand bleeds into every surface. The frontend writes
    # it to --tint, which every surface token in index.css mixes against, so one
    # number tints backgrounds, cards, borders and the sidebar together.
    brand_tint: int | None = None


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
    brand_color: str | None = None
    brand_tint: int | None = Field(default=None, ge=0, le=12)
    extra: dict[str, Any] | None = None
