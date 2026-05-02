from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.documents.portal_service import PortalService
from app.features.documents.schemas import (
    AnonymousUploadResponse,
    AssignmentCreate,
    AssignmentResponse,
    DocumentResponse,
    DocumentUpdate,
    PortalCreate,
    PortalResponse,
    PortalUpdate,
    PromoteUploadRequest,
    ShareLinkCreate,
    ShareLinkPublicView,
    ShareLinkResponse,
    ShareLinkUpdate,
)
from app.features.documents.service import DocumentService
from app.features.documents.share_service import ShareService

router = APIRouter(tags=["documents"])

# ----------------------------- Documents -----------------------------


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    tenant_id: UUID = Depends(get_tenant_id),
    contact_id: UUID | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
    area_id: UUID | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[dict]:
    return await DocumentService.list_documents(tenant_id, contact_id, property_id, area_id, q)


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.get_document(document_id, tenant_id)


@router.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=201,
)
async def create_document(
    file: UploadFile = File(...),
    display_name: str = Form(...),
    origin: str = Form(default="UPLOAD"),
    download_filename: str | None = Form(default=None),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    if origin not in {"UPLOAD", "CAMERA", "GENERATED"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid origin for direct upload",
        )
    content = await file.read()
    return await DocumentService.create_document_with_first_version(
        tenant_id=tenant_id,
        created_by=UUID(current_user["id"]),
        display_name=display_name,
        origin=origin,
        content=content,
        declared_mime=file.content_type,
        original_filename=file.filename,
        download_filename=download_filename,
    )


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.update_document(document_id, tenant_id, payload)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await DocumentService.soft_delete_document(document_id, tenant_id)


# ----------------------------- Versions -----------------------------


@router.post(
    "/documents/{document_id}/versions",
    response_model=DocumentResponse,
    status_code=201,
)
async def add_version(
    document_id: UUID,
    file: UploadFile = File(...),
    notes: str | None = Form(default=None),
    download_filename: str | None = Form(default=None),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    content = await file.read()
    return await DocumentService.add_version(
        document_id=document_id,
        tenant_id=tenant_id,
        created_by=UUID(current_user["id"]),
        content=content,
        declared_mime=file.content_type,
        original_filename=file.filename,
        notes=notes,
        download_filename=download_filename,
    )


@router.post(
    "/documents/{document_id}/versions/{version_id}/make-current",
    response_model=DocumentResponse,
)
async def make_version_current(
    document_id: UUID,
    version_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.set_current_version(document_id, version_id, tenant_id)


@router.get("/documents/{document_id}/versions/{version_id}/download")
async def download_version(
    document_id: UUID,
    version_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    url, _ = await DocumentService.get_version_signed_url(version_id, tenant_id)
    return {"url": url}


# ----------------------------- Assignments -----------------------------


@router.post(
    "/documents/{document_id}/assignments",
    response_model=AssignmentResponse,
    status_code=201,
)
async def create_assignment(
    document_id: UUID,
    payload: AssignmentCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.add_assignment(document_id, tenant_id, payload)


@router.delete(
    "/documents/{document_id}/assignments/{assignment_id}",
    status_code=204,
)
async def delete_assignment(
    document_id: UUID,
    assignment_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await DocumentService.remove_assignment(assignment_id, tenant_id)


# ----------------------------- Share links -----------------------------


@router.post(
    "/documents/{document_id}/share-links",
    response_model=ShareLinkResponse,
    status_code=201,
)
async def create_share_link(
    document_id: UUID,
    payload: ShareLinkCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    if payload.document_id != document_id:
        raise HTTPException(status_code=400, detail="document_id mismatch")
    return await ShareService.create_share_link(tenant_id, UUID(current_user["id"]), payload)


@router.get("/share-links", response_model=list[ShareLinkResponse])
async def list_share_links(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await ShareService.list_share_links(tenant_id)


@router.patch("/share-links/{link_id}", response_model=ShareLinkResponse)
async def update_share_link(
    link_id: UUID,
    payload: ShareLinkUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await ShareService.update_share_link(link_id, tenant_id, UUID(current_user["id"]), payload)


@router.delete("/share-links/{link_id}", status_code=204)
async def delete_share_link(
    link_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await ShareService.delete_share_link(link_id, tenant_id)


# ----------------------------- Public share resolver -----------------------------

public_router = APIRouter(tags=["public-share"])


@public_router.get("/r/{slug}", response_model=ShareLinkPublicView)
async def public_share_get(slug: str) -> dict:
    return await ShareService.resolve_public(slug)


@public_router.post("/r/{slug}/verify-password", response_model=ShareLinkPublicView)
async def public_share_password(slug: str, password: str = Form(...)) -> dict:
    return await ShareService.resolve_public(slug, password)


# ----------------------------- Anonymous portals -----------------------------


@router.post("/portals", response_model=PortalResponse, status_code=201)
async def create_portal(
    payload: PortalCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PortalService.create_portal(tenant_id, UUID(current_user["id"]), payload)


@router.get("/portals", response_model=list[PortalResponse])
async def list_portals(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await PortalService.list_portals(tenant_id)


@router.get("/portals/{portal_id}", response_model=PortalResponse)
async def get_portal(
    portal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PortalService.get_portal(portal_id, tenant_id)


@router.patch("/portals/{portal_id}", response_model=PortalResponse)
async def update_portal(
    portal_id: UUID,
    payload: PortalUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await PortalService.update_portal(portal_id, tenant_id, payload)


@router.delete("/portals/{portal_id}", status_code=204)
async def delete_portal(
    portal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await PortalService.delete_portal(portal_id, tenant_id)


@router.get(
    "/portals/{portal_id}/uploads",
    response_model=list[AnonymousUploadResponse],
)
async def list_uploads(
    portal_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await PortalService.list_uploads(portal_id, tenant_id)


@router.post("/uploads/{upload_id}/promote", response_model=DocumentResponse)
async def promote_upload(
    upload_id: UUID,
    payload: PromoteUploadRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await PortalService.promote_upload(
        upload_id,
        tenant_id,
        UUID(current_user["id"]),
        payload.display_name,
        payload.assignments,
    )


@router.post("/uploads/{upload_id}/reject", status_code=204)
async def reject_upload(
    upload_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
):
    await PortalService.reject_upload(upload_id, tenant_id, UUID(current_user["id"]))


# ----------------------------- Public portal -----------------------------


@public_router.get("/p/{slug}")
async def public_portal_get(slug: str) -> dict:
    return await PortalService.public_portal_view(slug)


@public_router.post("/p/{slug}/upload")
async def public_portal_upload(
    slug: str,
    request: Request,
    file: UploadFile = File(...),
    uploader_label: str | None = Form(default=None),
    consent: bool = Form(default=False),
    password: str | None = Form(default=None),
) -> dict:
    content = await file.read()
    client_host = request.client.host if request.client else None
    return await PortalService.public_upload(
        slug=slug,
        content=content,
        original_filename=file.filename,
        declared_mime=file.content_type,
        uploader_label=uploader_label,
        uploader_ip=client_host,
        consent=consent,
        password=password,
    )
