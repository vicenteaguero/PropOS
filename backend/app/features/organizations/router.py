from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.organizations.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.features.organizations.service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationResponse])
async def list_orgs(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await OrganizationService.list_organizations(tenant_id, kind, q, limit)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_org(org_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await OrganizationService.get_organization(org_id, tenant_id)


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_org(
    payload: OrganizationCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await OrganizationService.create_organization(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_org(
    org_id: UUID,
    payload: OrganizationUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await OrganizationService.update_organization(org_id, payload, tenant_id)


@router.delete("/{org_id}", status_code=204)
async def delete_org(org_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await OrganizationService.delete_organization(org_id, tenant_id)
