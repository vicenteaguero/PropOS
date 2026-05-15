from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.features.compliance.schemas import ConsentEvidence


class InvitationCreate(BaseModel):
    email: EmailStr
    property_id: UUID
    mode: Literal["visitor_only", "auth_user"]
    expires_in_days: int = Field(default=7, ge=1, le=30)
    confirm_duplicate: bool = False


class InvitationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    slug: str
    email: str
    property_id: UUID
    mode: str
    status: str
    expires_at: datetime
    invite_url: str
    contact_id: UUID | None = None
    user_id: UUID | None = None
    id_document_id: UUID | None = None
    created_at: datetime
    completed_at: datetime | None = None


class PreflightResponse(BaseModel):
    contact_exists_in_this_tenant: bool = False
    contact_exists_in_other_tenant: bool = False
    other_tenant_slugs: list[str] = []
    auth_user_exists: bool = False
    warnings: list[str] = []


class PrefilledData(BaseModel):
    full_name: str | None = None
    rut: str | None = None
    phone: str | None = None
    address: str | None = None


class InvitationPublicView(BaseModel):
    slug: str
    email: str
    property_title: str
    property_address: str | None = None
    tenant_slug: str
    mode: str
    consent_template_version: str = "1.0"
    existing_in_this_tenant: bool = False
    existing_account: bool = False
    prefilled: PrefilledData | None = None
    has_id_document: bool = False


class SubmitPayload(BaseModel):
    full_name: str
    rut: str
    phone: str | None = None
    address: str | None = None
    password: str | None = None
    consent_evidence: ConsentEvidence


class SubmitResponse(BaseModel):
    contact_id: UUID
    user_id: UUID | None = None
    message: str
    requires_email_confirmation: bool = False


class UploadIdResponse(BaseModel):
    document_id: UUID
