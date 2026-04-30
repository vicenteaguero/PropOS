from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.publications.schemas import (
    PublicationCreate,
    PublicationResponse,
    PublicationUpdate,
)
from app.features.publications.service import PublicationService

router = APIRouter(prefix="/publications", tags=["publications"])


@router.get("", response_model=list[PublicationResponse])
async def list_publications(
    tenant_id: UUID = Depends(get_tenant_id),
    property_id: UUID | None = Query(default=None),
    portal_org_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, le=500),
) -> list[dict]:
    return await PublicationService.list_publications(
        tenant_id, property_id, portal_org_id, status, limit
    )


@router.post("", response_model=PublicationResponse, status_code=201)
async def create_publication(
    payload: PublicationCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PublicationService.create_publication(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch("/{pub_id}", response_model=PublicationResponse)
async def update_publication(
    pub_id: UUID,
    payload: PublicationUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PublicationService.update_publication(pub_id, payload, tenant_id)


@router.delete("/{pub_id}", status_code=204)
async def delete_publication(
    pub_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
):
    await PublicationService.delete_publication(pub_id, tenant_id)
