from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TenantSettings(BaseModel):
    ai_assistant_name: str = "Anita"
    default_paper_size: str = "A4"


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    settings: TenantSettings


class TenantSettingsUpdate(BaseModel):
    ai_assistant_name: str | None = None
    default_paper_size: str | None = None
    extra: dict[str, Any] | None = None
