from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id, require_role
from app.features.contacts.schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
)
from app.features.contacts.service import ContactService

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactResponse], dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def list_contacts(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await ContactService.list_contacts(tenant_id)


@router.get("/{contact_id}", response_model=ContactResponse, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def get_contact(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.get_contact(contact_id, tenant_id)


@router.post("", response_model=ContactResponse, status_code=201, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def create_contact(
    payload: ContactCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.create_contact(payload, tenant_id)


@router.patch("/{contact_id}", response_model=ContactResponse, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def update_contact(
    contact_id: UUID,
    payload: ContactUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.update_contact(contact_id, payload, tenant_id)


@router.delete("/{contact_id}", status_code=204, dependencies=[Depends(require_role("ADMIN"))])
async def delete_contact(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await ContactService.delete_contact(contact_id, tenant_id)
