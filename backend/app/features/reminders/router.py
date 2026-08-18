from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_role, require_scope
from app.features.reminders.schemas import ReminderCreate, ReminderResponse
from app.features.reminders.service import ReminderService

router = APIRouter(
    prefix="/reminders",
    tags=["reminders"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("productividad")),
    ],
)


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    tenant_id: UUID = Depends(get_tenant_id),
    target_table: str | None = Query(default=None),
    target_row_id: UUID | None = Query(default=None),
) -> list[dict]:
    return await ReminderService.list_reminders(tenant_id, target_table, target_row_id)


@router.post("", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    payload: ReminderCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await ReminderService.create_reminder(payload, tenant_id, UUID(current_user["id"]))


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(reminder_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await ReminderService.delete_reminder(reminder_id, tenant_id)
