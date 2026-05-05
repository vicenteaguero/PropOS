from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    AGENT = "AGENT"
    LANDOWNER = "LANDOWNER"
    BUYER = "BUYER"
    CONTENT = "CONTENT"


class UserBase(BaseModel):
    full_name: str | None = None
    role: UserRole = UserRole.AGENT
    is_active: bool = True
    email: str | None = None
    rut: str | None = None


class UserCreate(BaseModel):
    email: str
    password: str | None = None
    full_name: str
    rut: str | None = None
    role: UserRole = UserRole.AGENT
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    rut: str | None = None


class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
