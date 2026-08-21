"""Wire shapes for the two catalogs a brokerage edits instead of deploying."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class TemplateChannel(StrEnum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class TemplateCategory(StrEnum):
    """Meta's billing categories. `marketing` is the expensive one."""

    UTILITY = "utility"
    MARKETING = "marketing"
    AUTHENTICATION = "authentication"


class ApprovalStatus(StrEnum):
    """Where the template stands with Meta.

    Only `APPROVED` can leave the 24 h service window, which makes this the
    column that decides whether a template is a message or a draft.
    """

    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class MessageTemplate(BaseModel):
    id: UUID
    name: str
    channel: TemplateChannel
    category: TemplateCategory
    language: str
    body: str
    #: Ordered names for Meta's positional `{{1}}..{{n}}`. Index i names `{{i+1}}`.
    variables: list[str]
    external_name: str | None = None
    approval_status: ApprovalStatus
    approved_at: datetime | None = None
    updated_at: datetime | None = None


class MessageTemplateWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    channel: TemplateChannel = TemplateChannel.WHATSAPP
    category: TemplateCategory = TemplateCategory.UTILITY
    language: str = Field(default="es", min_length=2, max_length=10)
    body: str = Field(min_length=1)
    variables: list[str] = Field(default_factory=list)
    external_name: str | None = None
    approval_status: ApprovalStatus = ApprovalStatus.DRAFT


class ChecklistItem(BaseModel):
    id: UUID | None = None
    #: 1-based, and the server owns it — the client sends the array in order.
    position: int
    title: str
    description: str | None = None
    #: A blocking item stops the close. Everything else is a reminder.
    blocking: bool = False
    owner_role: str | None = None
    due_offset_days: int | None = None
    document_kind: str | None = None


class ChecklistItemWrite(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    blocking: bool = False
    owner_role: str | None = None
    due_offset_days: int | None = None
    document_kind: str | None = None


class ChecklistTemplate(BaseModel):
    id: UUID
    name: str
    operation_kind: str
    is_default: bool
    items: list[ChecklistItem] = Field(default_factory=list)
    updated_at: datetime | None = None


class ChecklistTemplateWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    operation_kind: str = Field(default="venta", min_length=1, max_length=40)
    is_default: bool = False
    #: The whole list, in the order it should run. Replaces what is stored.
    items: list[ChecklistItemWrite] = Field(default_factory=list)
