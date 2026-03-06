from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id, require_role
from app.features.projects.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.features.projects.service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse], dependencies=[Depends(require_role("ADMIN", "MANAGER", "AGENT", "VIEWER"))])
async def list_projects(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await ProjectService.list_projects(tenant_id)


@router.get("/{project_id}", response_model=ProjectResponse, dependencies=[Depends(require_role("ADMIN", "MANAGER", "AGENT", "VIEWER"))])
async def get_project(
    project_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ProjectService.get_project(project_id, tenant_id)


@router.post("", response_model=ProjectResponse, status_code=201, dependencies=[Depends(require_role("ADMIN", "MANAGER", "AGENT"))])
async def create_project(
    payload: ProjectCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ProjectService.create_project(payload, tenant_id)


@router.patch("/{project_id}", response_model=ProjectResponse, dependencies=[Depends(require_role("ADMIN", "MANAGER", "AGENT"))])
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ProjectService.update_project(project_id, payload, tenant_id)


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(require_role("ADMIN", "MANAGER"))])
async def delete_project(
    project_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await ProjectService.delete_project(project_id, tenant_id)
