from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.features.projects.constants import ProjectStatus


class ProjectBase(BaseModel):
    title: str
    slug: str
    status: ProjectStatus = ProjectStatus.DRAFT
    property_id: UUID | None = None
    microsite_config: dict[str, Any] | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    status: ProjectStatus | None = None
    property_id: UUID | None = None
    microsite_config: dict[str, Any] | None = None


class ProjectResponse(ProjectBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
