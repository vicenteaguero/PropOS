from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_feature, require_role, require_scope
from app.features.grants.access import assert_property_granted, is_grant_scoped
from app.features.interactions.schemas import (
    InteractionCreate,
    InteractionResponse,
    InteractionUpdate,
    OwnerVisitResponse,
    shared_with_owner,
)
from app.features.interactions.service import InteractionService

# Split like the documents router: the Dueño's "Visitas" tab reads this same
# listing endpoint, so the role gate cannot sit on the whole router. `router`
# carries the scope gate plus that one shared read; `staff_router` — included at
# the bottom of this module — carries everything else, ADMIN/AGENT only.
router = APIRouter(
    prefix="/interactions",
    tags=["interactions"],
    dependencies=[Depends(require_scope("crm")), Depends(require_feature("crm"))],
)
STAFF_ONLY = Depends(require_role("ADMIN", "AGENT"))
staff_router = APIRouter(dependencies=[STAFF_ONLY])

LIST_ROLES = ("ADMIN", "AGENT", "LANDOWNER")


@router.get(
    "",
    # Two shapes share this path, so the models are applied by hand below
    # instead of through `response_model`.
    response_model=None,
    dependencies=[Depends(require_role(*LIST_ROLES))],
)
async def list_interactions(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    person_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[InteractionResponse] | list[OwnerVisitResponse]:
    if is_grant_scoped(current_user):
        # The Dueño sees one of its own properties, and only the interactions
        # the broker explicitly shared with the `owner` audience. `person_id`
        # is ignored: filtering by a CRM person is a staff-side query.
        assert_property_granted(current_user, tenant_id, property_id)
        rows = await InteractionService.list_interactions(tenant_id, kind, None, property_id, limit)
        return [OwnerVisitResponse.from_row(row) for row in rows if shared_with_owner(row)]

    rows = await InteractionService.list_interactions(tenant_id, kind, person_id, property_id, limit)
    return [InteractionResponse.model_validate(row) for row in rows]


@staff_router.get("/{interaction_id}", response_model=InteractionResponse)
async def get_interaction(interaction_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await InteractionService.get_interaction(interaction_id, tenant_id)


@router.post("", response_model=InteractionResponse, status_code=201, dependencies=[STAFF_ONLY])
async def create_interaction(
    payload: InteractionCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await InteractionService.create_interaction(payload, tenant_id, UUID(current_user["id"]))


@staff_router.patch("/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    interaction_id: UUID,
    payload: InteractionUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await InteractionService.update_interaction(interaction_id, payload, tenant_id)


@staff_router.delete("/{interaction_id}", status_code=204)
async def delete_interaction(interaction_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await InteractionService.delete_interaction(interaction_id, tenant_id)


# Included last so the shared listing above is matched before the staff routes.
router.include_router(staff_router)
