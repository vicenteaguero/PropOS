from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ProjectKind(str, Enum):
    PARCELACION = "PARCELACION"
    COMMERCIAL_RETAIL = "COMMERCIAL_RETAIL"
    RESIDENTIAL = "RESIDENTIAL"
    LAND_SUBDIVISION = "LAND_SUBDIVISION"
    OFFICE = "OFFICE"
    INDUSTRIAL = "INDUSTRIAL"
    OTHER = "OTHER"


class ProjectStatus(str, Enum):
    PLANNED = "PLANNED"
    ACTIVE = "ACTIVE"
    ON_HOLD = "ON_HOLD"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"


class ProjectBase(BaseModel):
    name: str
    kind: ProjectKind = ProjectKind.OTHER
    status: ProjectStatus = ProjectStatus.ACTIVE
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    parent_project_id: UUID | None = None
    primary_place_id: UUID | None = None
    metadata: dict[str, Any] = {}


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    kind: ProjectKind | None = None
    status: ProjectStatus | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    parent_project_id: UUID | None = None
    primary_place_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class ProjectResponse(ProjectBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}
