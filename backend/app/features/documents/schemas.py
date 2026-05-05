from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentKind(str, Enum):
    PDF = "PDF"
    DOCX = "DOCX"
    IMAGE_PDF = "IMAGE_PDF"
    OTHER = "OTHER"


class DocumentOrigin(str, Enum):
    UPLOAD = "UPLOAD"
    CAMERA = "CAMERA"
    ANONYMOUS_PORTAL = "ANONYMOUS_PORTAL"
    GENERATED = "GENERATED"


class AssignmentTarget(str, Enum):
    CONTACT = "CONTACT"
    PROPERTY = "PROPERTY"
    INTERNAL_AREA = "INTERNAL_AREA"


class PortalAccess(str, Enum):
    PUBLIC = "PUBLIC"
    PASSWORD = "PASSWORD"
    QR_ONLY = "QR_ONLY"


# --------------------- Documents ---------------------


class DocumentVersionResponse(BaseModel):
    id: UUID
    document_id: UUID
    version_number: int
    raw_path: str
    normalized_path: str
    size_bytes: int
    page_count: int | None = None
    sha256: str
    mime_type: str
    original_filename: str | None = None
    download_filename: str | None = None
    scan_status: str
    ocr_status: str
    ai_analysis_status: str
    notes: str | None = None
    edit_metadata: dict | None = None
    source_raw_path: str | None = None
    source_image_paths: list[str] = Field(default_factory=list)
    source_edit_states: list[dict] = Field(default_factory=list)
    # Transient signed URLs hydrated on GET; not persisted.
    source_image_urls: list[str] | None = None
    thumbnail_path: str | None = None
    thumbnail_url: str | None = None
    created_by: UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    target_kind: AssignmentTarget
    contact_id: UUID | None = None
    property_id: UUID | None = None
    internal_area_id: UUID | None = None


class AssignmentResponse(AssignmentCreate):
    id: UUID
    document_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentBase(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    kind: DocumentKind = DocumentKind.PDF
    origin: DocumentOrigin = DocumentOrigin.UPLOAD
    tag: str | None = None


class DocumentUpdate(BaseModel):
    display_name: str | None = None
    sort_order: int | None = None
    tag: str | None = None


class DocumentResponse(DocumentBase):
    id: UUID
    tenant_id: UUID
    current_version_id: UUID | None = None
    sort_order: int
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    versions: list[DocumentVersionResponse] | None = None
    assignments: list[AssignmentResponse] | None = None
    current_version: DocumentVersionResponse | None = None

    model_config = {"from_attributes": True}


class VersionCreateMeta(BaseModel):
    notes: str | None = None
    download_filename: str | None = None


# --------------------- Share links ---------------------


class ShareLinkCreate(BaseModel):
    document_id: UUID
    pinned_version_id: UUID | None = None
    password: str | None = None
    expires_at: datetime | None = None
    download_filename_override: str | None = None


class ShareLinkUpdate(BaseModel):
    document_id: UUID | None = None
    pinned_version_id: UUID | None = None
    password: str | None = None
    clear_password: bool = False
    expires_at: datetime | None = None
    download_filename_override: str | None = None
    is_active: bool | None = None


class ShareLinkResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    slug: str
    document_id: UUID
    pinned_version_id: UUID | None = None
    has_password: bool
    expires_at: datetime | None = None
    download_filename_override: str | None = None
    is_active: bool
    view_count: int
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShareLinkPublicView(BaseModel):
    slug: str
    document_display_name: str
    version_number: int
    sha256_short: str
    mime_type: str
    page_count: int | None = None
    download_filename: str
    download_url: str
    requires_password: bool = False
    expires_at: datetime | None = None


# --------------------- Anonymous portals ---------------------


class PortalBase(BaseModel):
    title: str
    description: str | None = None
    access_mode: PortalAccess = PortalAccess.PASSWORD
    default_property_id: UUID | None = None
    default_contact_id: UUID | None = None
    default_internal_area_id: UUID | None = None
    max_file_size_mb: int = Field(default=50, ge=1, le=200)
    expires_at: datetime | None = None


class PortalCreate(PortalBase):
    password: str | None = None


class PortalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    access_mode: PortalAccess | None = None
    password: str | None = None
    clear_password: bool = False
    default_property_id: UUID | None = None
    default_contact_id: UUID | None = None
    default_internal_area_id: UUID | None = None
    max_file_size_mb: int | None = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class PortalResponse(PortalBase):
    id: UUID
    tenant_id: UUID
    slug: str
    has_password: bool
    is_active: bool
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AnonymousUploadResponse(BaseModel):
    id: UUID
    portal_id: UUID
    storage_path: str
    original_filename: str | None = None
    size_bytes: int | None = None
    sha256: str | None = None
    mime_type: str | None = None
    uploader_label: str | None = None
    consent_given_at: datetime | None = None
    status: str
    promoted_document_id: UUID | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PromoteUploadRequest(BaseModel):
    display_name: str
    assignments: list[AssignmentCreate] = Field(default_factory=list)


# --------------------- Stubs (plug-in interfaces) ---------------------


class StubResult(BaseModel):
    plugin: str
    status: str = "not_implemented"
    detail: str | None = None
    extra: dict[str, Any] | None = None
