from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.dependencies import get_current_user, get_tenant_id, require_dev_admin, require_role
from app.features.grants.schemas import PropertyGrantResponse
from app.features.grants.service import GrantService
from app.features.properties.describe import generate_description
from app.features.properties.photos import (
    ALLOWED_IMAGE_MIME,
    MAX_PHOTO_BYTES,
    MAX_PHOTOS_PER_REQUEST,
    PropertyNotFoundError,
    PropertyPhotoService,
)
from app.features.properties.publish import NotPublishableError
from app.features.properties.schemas import (
    BuildingContext,
    PriceHistoryEntry,
    GeneratedDescription,
    GenerateDescriptionRequest,
    PropertyCreate,
    PropertyPhoto,
    PropertyResponse,
    PropertyUpdate,
)
from app.features.properties.service import PropertyService

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get(
    "",
    response_model=list[PropertyResponse],
    dependencies=[Depends(require_role("ADMIN", "AGENT", "LANDOWNER", "CONTENT"))],
)
async def list_properties(
    tenant_id: UUID = Depends(get_tenant_id),
    q: str | None = Query(default=None),
    include_drafts: bool = Query(default=True),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    return await PropertyService.list_properties(tenant_id, q, include_drafts, limit, offset)


@router.get(
    "/{property_id}",
    response_model=PropertyResponse,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "LANDOWNER", "CONTENT"))],
)
async def get_property(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PropertyService.get_property(property_id, tenant_id)


@router.post(
    "",
    response_model=PropertyResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "CONTENT"))],
)
async def create_property(
    payload: PropertyCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PropertyService.create_property(payload, tenant_id, UUID(current_user["id"]))


@router.patch(
    "/{property_id}",
    response_model=PropertyResponse,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "CONTENT"))],
)
async def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    try:
        return await PropertyService.update_property(property_id, payload, tenant_id)
    except NotPublishableError as exc:
        # 409, not 400: the request is well formed, the record is not ready.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede publicar. {' '.join(exc.reasons)}",
        ) from exc


@router.delete("/{property_id}", status_code=204, dependencies=[Depends(require_dev_admin)])
async def delete_property(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await PropertyService.delete_property(property_id, tenant_id)


@router.post(
    "/{property_id}/generate-description",
    response_model=GeneratedDescription,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "CONTENT"))],
)
async def generate_property_description(
    property_id: UUID,
    payload: GenerateDescriptionRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await generate_description(property_id, tenant_id, payload.tone, payload.portal, payload.max_words)


@router.get(
    "/{property_id}/history",
    response_model=list[PriceHistoryEntry],
    dependencies=[Depends(require_role("ADMIN", "AGENT", "LANDOWNER", "CONTENT"))],
)
async def get_property_history(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    """Price and status changes, newest first. Empty for a property that has
    never moved, which is the honest answer rather than an invented baseline."""
    return await PropertyService.get_price_history(tenant_id, property_id)


@router.get(
    "/{property_id}/building",
    response_model=BuildingContext | None,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "LANDOWNER", "CONTENT"))],
)
async def get_property_building(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict | None:
    """The building this unit belongs to, and the other units in it.

    Null for a standalone house, which is most of the inventory — the caller
    renders nothing rather than an empty section.
    """
    return await PropertyService.get_building_context(tenant_id, property_id)


@router.get(
    "/{property_id}/grants",
    response_model=list[PropertyGrantResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def list_property_grants(property_id: UUID) -> list[dict]:
    return await GrantService.list_for_property(property_id)


@router.get(
    "/{property_id}/photos",
    response_model=list[PropertyPhoto],
    dependencies=[Depends(require_role("ADMIN", "AGENT", "LANDOWNER", "CONTENT"))],
)
async def list_property_photos(
    property_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    """Gallery for the property, including photos the agent attached over WhatsApp."""
    try:
        return await PropertyPhotoService.list_photos(property_id, tenant_id)
    except PropertyNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found") from exc


@router.post(
    "/{property_id}/photos",
    response_model=list[PropertyPhoto],
    status_code=201,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "CONTENT"))],
)
async def upload_property_photos(
    property_id: UUID,
    files: list[UploadFile] = File(...),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    if len(files) > MAX_PHOTOS_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_PHOTOS_PER_REQUEST} photos per request",
        )

    payload: list[tuple[bytes, str | None, str | None]] = []
    for upload in files:
        mime = (upload.content_type or "").lower()
        if mime not in ALLOWED_IMAGE_MIME:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported image type: {upload.content_type or 'unknown'}",
            )
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
        if len(content) > MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Photo exceeds {MAX_PHOTO_BYTES // (1024 * 1024)}MB",
            )
        payload.append((content, mime, upload.filename))

    try:
        return await PropertyPhotoService.add_photos(property_id, tenant_id, UUID(current_user["id"]), payload)
    except PropertyNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found") from exc


@router.delete(
    "/{property_id}/photos/{asset_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN", "AGENT", "CONTENT"))],
)
async def delete_property_photo(
    property_id: UUID,
    asset_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    deleted = await PropertyPhotoService.delete_photo(asset_id, property_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
