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
from app.features.events import types_service
from app.features.events.schemas import EventTypeCreate, EventTypeResponse, EventTypeUpdate
from app.features.settings import service
from app.features.settings.schemas import (
    ChecklistTemplate,
    ChecklistTemplateWrite,
    MessageTemplate,
    MessageTemplateWrite,
    Pipeline,
    PipelineWrite,
    Tag,
    TagWrite,
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


# --- Pipelines -------------------------------------------------------------


@router.get("/pipelines", response_model=list[Pipeline])
async def list_pipelines(tenant_id: UUID = Depends(get_tenant_id)) -> list[Pipeline]:
    """Pipelines with their declared transitions and how many deals ride them.

    A pipeline that comes back with an EMPTY `transitions` list is not
    misconfigured data the caller should hide — `assert_allowed` treats it as
    unconstrained, so the screen has to say the state machine is off.
    """
    return service.list_pipelines(tenant_id)


@router.post("/pipelines", response_model=Pipeline, status_code=status.HTTP_201_CREATED)
async def create_pipeline(payload: PipelineWrite, tenant_id: UUID = Depends(get_tenant_id)) -> Pipeline:
    return service.create_pipeline(tenant_id, payload)


@router.get("/pipelines/{pipeline_id}", response_model=Pipeline)
async def get_pipeline(pipeline_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> Pipeline:
    return service.get_pipeline(tenant_id, pipeline_id)


@router.put("/pipelines/{pipeline_id}", response_model=Pipeline)
async def update_pipeline(
    pipeline_id: UUID,
    payload: PipelineWrite,
    tenant_id: UUID = Depends(get_tenant_id),
) -> Pipeline:
    return service.update_pipeline(tenant_id, pipeline_id, payload)


@router.delete("/pipelines/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(pipeline_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> None:
    """Deals keep existing: `opportunities.pipeline_id` is ON DELETE SET NULL,
    so they come out of this with no pipeline and therefore no rules."""
    service.delete_pipeline(tenant_id, pipeline_id)


# --- Tags ------------------------------------------------------------------


@router.get("/tags", response_model=list[Tag])
async def list_tags(tenant_id: UUID = Depends(get_tenant_id)) -> list[Tag]:
    """Tags with how many rows carry each one."""
    return service.list_tags(tenant_id)


@router.post("/tags", response_model=Tag, status_code=status.HTTP_201_CREATED)
async def create_tag(payload: TagWrite, tenant_id: UUID = Depends(get_tenant_id)) -> Tag:
    return service.create_tag(tenant_id, payload)


@router.put("/tags/{tag_id}", response_model=Tag)
async def update_tag(tag_id: UUID, payload: TagWrite, tenant_id: UUID = Depends(get_tenant_id)) -> Tag:
    return service.update_tag(tenant_id, tag_id, payload)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> None:
    """Cascades to `taggings`: the label comes off every row that carried it."""
    service.delete_tag(tenant_id, tag_id)


# --- Event types -----------------------------------------------------------
#
# Reads live on the events router, unauthenticated by role beyond the usual
# broker gate: a calendar that cannot name its own types is not a calendar.
# Writes are here, with the rest of the catalogs.


@router.get("/event-types", response_model=list[EventTypeResponse])
async def list_event_types(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict[str, Any]]:
    """Every type, including the deactivated ones the calendar hides."""
    return await types_service.list_types(tenant_id, only_active=False)


@router.post("/event-types", response_model=EventTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_event_type(payload: EventTypeCreate, tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    return types_service.create_type(tenant_id, payload)


@router.put("/event-types/{type_id}", response_model=EventTypeResponse)
async def update_event_type(
    type_id: UUID, payload: EventTypeUpdate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict[str, Any]:
    return types_service.update_type(tenant_id, type_id, payload)


@router.delete("/event-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_type(type_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> None:
    """Deactivates instead of deleting when events already carry the key."""
    types_service.delete_type(tenant_id, type_id)
