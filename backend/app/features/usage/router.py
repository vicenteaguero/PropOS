"""Usage ingest (any signed-in user) and the Uso dashboard read (dev admin)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_dev_admin
from app.features.usage import service
from app.features.usage.schemas import UsageBatch, UsageSummary

router = APIRouter(prefix="/usage", tags=["usage"])


@router.post("/events", status_code=202)
async def record_events(
    payload: UsageBatch,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, int]:
    """Accept one flush of the client buffer.

    202 rather than 201: the client sends this with `sendBeacon` on page hide
    and cannot read the response anyway, and telemetry must never be something
    the app waits on.
    """
    written = service.record_events(tenant_id, UUID(current_user["id"]), payload.events)
    return {"recorded": written}


@router.get("/summary", response_model=UsageSummary, dependencies=[Depends(require_dev_admin)])
async def usage_summary(
    tenant_id: UUID = Depends(get_tenant_id),
    days: int = Query(default=14, ge=1, le=90),
) -> dict[str, Any]:
    return service.summary(tenant_id, days)
