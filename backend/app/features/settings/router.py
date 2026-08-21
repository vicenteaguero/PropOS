"""Configuración → Clientes: the two catalogs, over HTTP.

ADMIN-gated at the router, the same way `agent/policies_api.py` is: a message
that leaves the brokerage under its own name and the list that governs a close
are administration, not day-to-day work.

Route order matters — FastAPI matches by declaration position, not by
specificity, so a literal segment declared after `/{template_id}` is parsed as
that parameter and 422s. Both catalogs live behind their own literal prefix
here, and `tests/features/test_settings_routes.py` pins the ordering.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.settings import service
from app.features.settings.schemas import (
    ChecklistTemplate,
    ChecklistTemplateWrite,
    MessageTemplate,
    MessageTemplateWrite,
)

router = APIRouter(
    prefix="/settings",
    tags=["settings-catalogs"],
    dependencies=[Depends(require_role("ADMIN"))],
)


# --- Message templates -----------------------------------------------------


@router.get("/message-templates", response_model=list[MessageTemplate])
async def list_message_templates(tenant_id: UUID = Depends(get_tenant_id)) -> list[MessageTemplate]:
    """Every template this brokerage has, approved or not.

    Unlike the send-side reader in `notifications/whatsapp/templates.py` this
    does not filter on `approved`: the point of the screen is to show that a
    draft cannot be sent.
    """
    return service.list_message_templates(tenant_id)


@router.post("/message-templates", response_model=MessageTemplate, status_code=status.HTTP_201_CREATED)
async def create_message_template(
    payload: MessageTemplateWrite,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> MessageTemplate:
    return service.create_message_template(tenant_id, UUID(str(current_user["id"])), payload)


@router.put("/message-templates/{template_id}", response_model=MessageTemplate)
async def update_message_template(
    template_id: UUID,
    payload: MessageTemplateWrite,
    tenant_id: UUID = Depends(get_tenant_id),
) -> MessageTemplate:
    return service.update_message_template(tenant_id, template_id, payload)


@router.delete("/message-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message_template(template_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> None:
    service.delete_message_template(tenant_id, template_id)


# --- Checklist templates ---------------------------------------------------


@router.get("/checklist-templates", response_model=list[ChecklistTemplate])
async def list_checklist_templates(tenant_id: UUID = Depends(get_tenant_id)) -> list[ChecklistTemplate]:
    """Templates with their items, so the editor opens without a second call."""
    return service.list_checklist_templates(tenant_id)


@router.post("/checklist-templates", response_model=ChecklistTemplate, status_code=status.HTTP_201_CREATED)
async def create_checklist_template(
    payload: ChecklistTemplateWrite,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ChecklistTemplate:
    return service.create_checklist_template(tenant_id, UUID(str(current_user["id"])), payload)


@router.get("/checklist-templates/{template_id}", response_model=ChecklistTemplate)
async def get_checklist_template(template_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> ChecklistTemplate:
    return service.get_checklist_template(tenant_id, template_id)


@router.put("/checklist-templates/{template_id}", response_model=ChecklistTemplate)
async def update_checklist_template(
    template_id: UUID,
    payload: ChecklistTemplateWrite,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ChecklistTemplate:
    return service.update_checklist_template(tenant_id, template_id, payload)


@router.delete("/checklist-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist_template(template_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> None:
    service.delete_checklist_template(tenant_id, template_id)
