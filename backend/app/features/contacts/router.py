from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.contacts.schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
)
from app.features.contacts.service import ContactService

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactResponse])
async def list_contacts(
    tenant_id: UUID = Depends(get_tenant_id),
    q: str | None = Query(default=None),
    include_drafts: bool = Query(default=True),
) -> list[dict]:
    return await ContactService.list_contacts(tenant_id, q, include_drafts)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.get_contact(contact_id, tenant_id)


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    payload: ContactCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await ContactService.create_contact(
        payload, tenant_id, UUID(current_user["id"])
    )


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: UUID,
    payload: ContactUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.update_contact(contact_id, payload, tenant_id)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await ContactService.delete_contact(contact_id, tenant_id)
