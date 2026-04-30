from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.projects.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.features.projects.service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await ProjectService.list_projects(tenant_id, kind, status, q, limit)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await ProjectService.get_project(project_id, tenant_id)


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    payload: ProjectCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await ProjectService.create_project(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ProjectService.update_project(project_id, payload, tenant_id)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
):
    await ProjectService.delete_project(project_id, tenant_id)
