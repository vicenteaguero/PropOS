from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.features.memberships.schemas import UserView


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    AGENT = "AGENT"
    LANDOWNER = "LANDOWNER"
    BUYER = "BUYER"
    CONTENT = "CONTENT"


class EmailPurpose(str, Enum):
    ALL = "all"
    NOTIFICATIONS = "notifications"
    BILLING = "billing"
    MARKETING = "marketing"
    SECURITY = "security"


class UserBase(BaseModel):
    full_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    paternal_surname: str | None = None
    maternal_surname: str | None = None
    role: UserRole = UserRole.AGENT
    is_active: bool = True
    email: str | None = None
    rut: str | None = None
    avatar_url: str | None = None
    admin_scope: list[str] = []
    is_dev_admin: bool = False
    view: UserView = UserView.AGENT


class AvatarUpdate(BaseModel):
    avatar_url: str | None = None


class TenantMembershipSpec(BaseModel):
    tenant_id: UUID
    role: UserRole = UserRole.ADMIN
    admin_scope: list[str] = []
    is_dev_admin: bool = False
    view: UserView = UserView.ADMIN


class AdditionalEmail(BaseModel):
    email: EmailStr
    label: str | None = None
    purpose: EmailPurpose = EmailPurpose.ALL


class UserCreate(BaseModel):
    """Legacy direct-create payload. Sets a password + confirms email.

    Prefer UserInvite for human users (magic link). Use this for fake/future
    emails where the recipient cannot click an invite.
    """

    email: str
    password: str | None = None
    full_name: str | None = None
    first_name: str | None = None
    middle_name: str | None = None
    paternal_surname: str | None = None
    maternal_surname: str | None = None
    rut: str | None = None
    role: UserRole = UserRole.AGENT
    is_active: bool = True
    memberships: list[TenantMembershipSpec] = []
    additional_emails: list[AdditionalEmail] = []


class UserInvite(BaseModel):
    """Invite a user via Supabase magic link."""

    primary_email: EmailStr
    first_name: str = Field(min_length=1)
    middle_name: str | None = None
    paternal_surname: str = Field(min_length=1)
    maternal_surname: str | None = None
    rut: str | None = None
    memberships: list[TenantMembershipSpec] = []
    additional_emails: list[AdditionalEmail] = []


class UserUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    paternal_surname: str | None = None
    maternal_surname: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    rut: str | None = None
    avatar_url: str | None = None
    admin_scope: list[str] | None = None
    is_dev_admin: bool | None = None
    view: UserView | None = None


class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    memberships: list[dict] = []
    user_emails: list[dict] = []
    grants: list[dict] = []


class UserEmailCreate(BaseModel):
    email: EmailStr
    label: str | None = None
    purpose: EmailPurpose = EmailPurpose.ALL
    is_primary: bool = False


class UserEmailResponse(BaseModel):
    id: UUID
    user_id: UUID
    tenant_id: UUID
    email: str
    label: str | None = None
    purpose: EmailPurpose
    is_primary: bool
    verified_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SetPasswordPayload(BaseModel):
    new_password: str = Field(min_length=8)


class ImpersonateResponse(BaseModel):
    magic_link: str
    expires_in_seconds: int = 3600
