from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies import get_tenant_id, require_role
from app.features.sharing.service import SharingService

router = APIRouter(prefix="/admin", tags=["sharing"])


class DocumentSharingPayload(BaseModel):
    audience_caps: dict[str, list[str]]
    property_id: UUID | None = None


class InteractionSharingPayload(BaseModel):
    audience_caps: dict[str, list[str]]


@router.patch(
    "/documents/{document_id}/sharing",
    dependencies=[Depends(require_role("ADMIN"))],
)
async def set_document_sharing(
    document_id: UUID,
    payload: DocumentSharingPayload,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await SharingService.set_document_sharing(document_id, tenant_id, payload.audience_caps, payload.property_id)


@router.patch(
    "/interactions/{interaction_id}/sharing",
    dependencies=[Depends(require_role("ADMIN"))],
)
async def set_interaction_sharing(
    interaction_id: UUID,
    payload: InteractionSharingPayload,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await SharingService.set_interaction_sharing(interaction_id, tenant_id, payload.audience_caps)
