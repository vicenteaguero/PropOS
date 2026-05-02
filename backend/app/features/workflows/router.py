from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.workflows.schemas import (
    WorkflowCreate,
    WorkflowResponse,
    WorkflowStepResponse,
    WorkflowStepUpdate,
)
from app.features.workflows.service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    tenant_id: UUID = Depends(get_tenant_id),
    scope_table: str | None = Query(default=None),
    scope_row_id: UUID | None = Query(default=None),
) -> list[dict]:
    return await WorkflowService.list_workflows(tenant_id, scope_table, scope_row_id)


@router.post("", response_model=WorkflowResponse, status_code=201)
async def create_workflow(
    payload: WorkflowCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await WorkflowService.create_workflow(payload, tenant_id, UUID(current_user["id"]))


@router.get("/{workflow_id}/steps", response_model=list[WorkflowStepResponse])
async def list_steps(workflow_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await WorkflowService.list_steps(workflow_id, tenant_id)


@router.patch("/{workflow_id}/steps/{step_id}", response_model=WorkflowStepResponse)
async def update_step(
    workflow_id: UUID,
    step_id: UUID,
    payload: WorkflowStepUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await WorkflowService.update_step(workflow_id, step_id, payload, tenant_id)
