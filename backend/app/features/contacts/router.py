from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_feature, require_role, require_scope
from app.features.contacts import identity
from app.features.contacts.overview import build_overview
from app.features.contacts.schemas import (
    AddEmailRequest,
    AddPhoneRequest,
    ContactChannels,
    ContactCreate,
    ContactDuplicate,
    ContactEmailOut,
    ContactOverview,
    ContactPhoneOut,
    MergeContactRequest,
    ContactResponse,
    ContactUpdate,
    PersonAliasResponse,
)
from app.features.contacts.service import ContactService

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("crm")),
        Depends(require_feature("crm")),
    ],
)


@router.get("", response_model=list[ContactResponse])
async def list_contacts(
    tenant_id: UUID = Depends(get_tenant_id),
    q: str | None = Query(default=None),
    fuzzy: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    include_drafts: bool = Query(default=True),
    include_deleted: bool = Query(default=False),
    property_id: UUID | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    if property_id is not None:
        return await ContactService.list_contacts_by_property(
            tenant_id, property_id, q, include_drafts, include_deleted, limit
        )
    if q and fuzzy:
        return await ContactService.search_fuzzy(tenant_id, q, limit)
    return await ContactService.list_contacts(tenant_id, q, include_drafts, include_deleted, limit, offset)


@router.get("/duplicates", response_model=list[ContactDuplicate])
async def list_duplicates(
    limit: int = Query(default=50, ge=1, le=200),
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[ContactDuplicate]:
    """People who look like the same person.

    Declared before `/{contact_id}` so the literal path is not swallowed by the
    uuid route — FastAPI matches in declaration order.
    """
    return identity.find_duplicates(tenant_id, limit)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.get_contact(contact_id, tenant_id)


@router.get("/{contact_id}/overview", response_model=ContactOverview)
async def contact_overview(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ContactOverview:
    """Deals, next booking, last contact and link counts in one round trip."""
    return await build_overview(tenant_id, contact_id)


@router.get("/{contact_id}/channels", response_model=ContactChannels)
async def get_channels(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ContactChannels:
    """Every number and address this person has."""
    return identity.list_channels(tenant_id, contact_id)


@router.post("/{contact_id}/phones", response_model=ContactPhoneOut, status_code=201)
async def add_phone(
    contact_id: UUID,
    payload: AddPhoneRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ContactPhoneOut:
    return identity.add_phone(tenant_id, contact_id, payload.phone, payload.label, payload.make_primary)


@router.delete("/{contact_id}/phones/{phone_id}", status_code=204)
async def delete_phone(
    contact_id: UUID,
    phone_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    identity.remove_phone(tenant_id, contact_id, phone_id)


@router.post("/{contact_id}/emails", response_model=ContactEmailOut, status_code=201)
async def add_email(
    contact_id: UUID,
    payload: AddEmailRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ContactEmailOut:
    return identity.add_email(tenant_id, contact_id, payload.email, payload.label, payload.make_primary)


@router.delete("/{contact_id}/emails/{email_id}", status_code=204)
async def delete_email(
    contact_id: UUID,
    email_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    identity.remove_email(tenant_id, contact_id, email_id)


@router.post("/{contact_id}/merge")
async def merge_contact(
    contact_id: UUID,
    payload: MergeContactRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    """Fold another contact into this one. `contact_id` is the survivor."""
    return identity.merge(tenant_id, contact_id, payload.loser_id)


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    payload: ContactCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await ContactService.create_contact(payload, tenant_id, UUID(current_user["id"]))


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
):
    await ContactService.delete_contact(contact_id, tenant_id)


@router.get("/{contact_id}/aliases", response_model=list[PersonAliasResponse])
async def list_aliases(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await ContactService.list_aliases(contact_id, tenant_id)


@router.post("/{contact_id}/aliases", response_model=PersonAliasResponse, status_code=201)
async def add_alias(
    contact_id: UUID,
    alias: str,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await ContactService.add_alias(contact_id, tenant_id, alias)
