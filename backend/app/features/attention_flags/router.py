from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.attention_flags import service

router = APIRouter(prefix="/attention-flags", tags=["attention-flags"])


class FlagRequest(BaseModel):
    target_kind: str = Field(pattern="^(CONTACT|PROPERTY)$")
    target_id: UUID
    #: Defaults to 48 h. Bounded so a "temporary" flag stays temporary.
    hours: int = Field(default=service.DEFAULT_HOURS, ge=1, le=24 * 14)
    note: str | None = None


@router.get("")
async def list_attention_flags(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict[str, Any]]:
    """Every flag still live. Shared across the workspace, by design."""
    return service.list_flags(tenant_id)


@router.post("")
async def set_attention_flag(
    payload: FlagRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    return service.set_flag(
        tenant_id,
        target_kind=payload.target_kind,
        target_id=payload.target_id,
        user_id=UUID(current_user["id"]),
        hours=payload.hours,
        note=payload.note,
    )


@router.delete("/{target_kind}/{target_id}", status_code=204)
async def clear_attention_flag(
    target_kind: str,
    target_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    """Anyone can clear anyone's flag — it is the workspace's, not a person's."""
    service.clear_flag(tenant_id, target_kind=target_kind.upper(), target_id=target_id)
