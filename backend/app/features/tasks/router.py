from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.tasks.schemas import TaskCreate, TaskResponse, TaskUpdate
from app.features.tasks.service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    status: str | None = Query(default=None),
    owner_user: UUID | None = Query(default=None),
    only_open: bool = Query(default=False),
    limit: int = Query(default=200, le=500),
) -> list[dict]:
    return await TaskService.list_tasks(
        tenant_id, kind, status, owner_user, only_open, limit
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TaskService.get_task(task_id, tenant_id)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await TaskService.create_task(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await TaskService.update_task(task_id, payload, tenant_id)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TaskService.delete_task(task_id, tenant_id)
