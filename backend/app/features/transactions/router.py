from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_feature, require_role, require_scope
from app.features.transactions.schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.features.transactions.service import TransactionService

router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("finanzas")),
        Depends(require_feature("finanzas")),
    ],
)


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    tenant_id: UUID = Depends(get_tenant_id),
    direction: str | None = Query(default=None),
    category: str | None = Query(default=None),
    project_id: UUID | None = Query(default=None),
    campaign_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await TransactionService.list_transactions(
        tenant_id, direction, category, project_id, campaign_id, property_id, status, limit, offset
    )


@router.get("/{tx_id}", response_model=TransactionResponse)
async def get_transaction(tx_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TransactionService.get_transaction(tx_id, tenant_id)


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await TransactionService.create_transaction(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
    tx_id: UUID,
    payload: TransactionUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await TransactionService.update_transaction(tx_id, payload, tenant_id)


@router.post("/{tx_id}/complete", response_model=TransactionResponse)
async def complete_transaction(tx_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TransactionService.complete_transaction(tx_id, tenant_id)


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(tx_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TransactionService.delete_transaction(tx_id, tenant_id)
