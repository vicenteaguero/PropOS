from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.interactions.schemas import (
    InteractionCreate,
    InteractionResponse,
    InteractionUpdate,
)
from app.features.interactions.service import InteractionService

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.get("", response_model=list[InteractionResponse])
async def list_interactions(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    person_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await InteractionService.list_interactions(
        tenant_id, kind, person_id, property_id, limit
    )


@router.get("/{interaction_id}", response_model=InteractionResponse)
async def get_interaction(
    interaction_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await InteractionService.get_interaction(interaction_id, tenant_id)


@router.post("", response_model=InteractionResponse, status_code=201)
async def create_interaction(
    payload: InteractionCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await InteractionService.create_interaction(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch("/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    interaction_id: UUID,
    payload: InteractionUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InteractionService.update_interaction(interaction_id, payload, tenant_id)


@router.delete("/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
):
    await InteractionService.delete_interaction(interaction_id, tenant_id)
