from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id
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
) -> list[dict]:
    return await InteractionService.list_interactions(tenant_id)


@router.get(
    "/{interaction_id}",
    response_model=InteractionResponse,
)
async def get_interaction(
    interaction_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InteractionService.get_interaction(interaction_id, tenant_id)


@router.post(
    "",
    response_model=InteractionResponse,
    status_code=201,
)
async def create_interaction(
    payload: InteractionCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InteractionService.create_interaction(payload, tenant_id)


@router.patch(
    "/{interaction_id}",
    response_model=InteractionResponse,
)
async def update_interaction(
    interaction_id: UUID,
    payload: InteractionUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InteractionService.update_interaction(
        interaction_id, payload, tenant_id
    )


@router.delete("/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await InteractionService.delete_interaction(interaction_id, tenant_id)
