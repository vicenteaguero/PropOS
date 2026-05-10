from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class UserView(str, Enum):
    ADMIN = "admin"
    ADMIN_DEV = "admin-dev"
    AGENT = "agent"
    OWNER = "owner"
    BUYER = "buyer"
    CONTENT = "content"


class TenantMembershipBase(BaseModel):
    tenant_id: UUID
    role: str
    admin_scope: list[str] = []
    is_dev_admin: bool = False
    view: UserView = UserView.AGENT
    is_active: bool = True


class TenantMembershipResponse(TenantMembershipBase):
    user_id: UUID
    tenant_name: str | None = None
    tenant_slug: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantMembershipCreate(TenantMembershipBase):
    pass


class TenantMembershipUpdate(BaseModel):
    role: str | None = None
    admin_scope: list[str] | None = None
    is_dev_admin: bool | None = None
    view: UserView | None = None
    is_active: bool | None = None


class ActivateTenantRequest(BaseModel):
    tenant_id: UUID
