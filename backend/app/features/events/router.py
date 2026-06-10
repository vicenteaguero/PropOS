from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.events.schemas import (
    CalendarItem,
    EventCreate,
    EventResponse,
    EventUpdate,
)
from app.features.events.service import EventService

router = APIRouter(
    prefix="/events",
    tags=["events"],
    dependencies=[Depends(require_role("ADMIN", "AGENT"))],
)


@router.get("", response_model=list[EventResponse])
async def list_events(
    tenant_id: UUID = Depends(get_tenant_id),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    assignee_user: UUID | None = Query(default=None),
    kind: str | None = Query(default=None),
) -> list[dict]:
    return await EventService.list_events(tenant_id, date_from, date_to, assignee_user, kind)


@router.get("/calendar", response_model=list[CalendarItem])
async def calendar_feed(
    tenant_id: UUID = Depends(get_tenant_id),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
) -> list[dict]:
    return await EventService.calendar_feed(tenant_id, date_from, date_to)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await EventService.get_event(event_id, tenant_id)


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    payload: EventCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await EventService.create_event(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    payload: EventUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await EventService.update_event(event_id, payload, tenant_id)


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await EventService.delete_event(event_id, tenant_id)
