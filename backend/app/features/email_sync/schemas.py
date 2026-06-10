from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EmailMessageResponse(BaseModel):
    id: UUID
    direction: str
    from_email: str | None = None
    from_name: str | None = None
    subject: str | None = None
    body_text: str | None = None
    snippet: str | None = None
    sent_at: datetime
    is_lead_email: bool
    portal: str | None = None

    model_config = {"from_attributes": True}


class EmailThreadResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    subject: str | None = None
    counterpart_email: str | None = None
    counterpart_name: str | None = None
    contact_id: UUID | None = None
    last_message_at: datetime | None = None
    message_count: int
    is_lead: bool
    portal: str | None = None
    status: str

    model_config = {"from_attributes": True}


class EmailThreadDetail(EmailThreadResponse):
    messages: list[EmailMessageResponse] = []


class ReplyRequest(BaseModel):
    body: str
    subject: str | None = None
