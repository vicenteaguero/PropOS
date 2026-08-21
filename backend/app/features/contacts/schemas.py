from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.core.rut import parse_rut
from app.features.compliance.schemas import ConsentEvidence


class ContactType(str, Enum):
    BUYER = "BUYER"
    SELLER = "SELLER"
    LANDOWNER = "LANDOWNER"
    NOTARY = "NOTARY"
    INVESTOR = "INVESTOR"
    EMPLOYEE = "EMPLOYEE"
    FAMILY = "FAMILY"
    VENDOR = "VENDOR"
    STAKEHOLDER = "STAKEHOLDER"
    OTHER = "OTHER"


class ContactBase(BaseModel):
    full_name: str
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType = ContactType.OTHER
    rut: str | None = None
    birthdate: date | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}
    is_draft: bool = False


class ContactCreate(ContactBase):
    aliases: list[str] = []
    consent_evidence: ConsentEvidence | None = None
    consent_purposes: list[str] = ["operacional"]
    consent_version: str = "1.0"

    @field_validator("rut")
    @classmethod
    def _canonical_rut(cls, value: str | None) -> str | None:
        return parse_rut(value)


class ContactUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    type: ContactType | None = None
    rut: str | None = None
    birthdate: date | None = None
    address: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None
    is_draft: bool | None = None

    @field_validator("rut")
    @classmethod
    def _canonical_rut(cls, value: str | None) -> str | None:
        return parse_rut(value)


class ContactResponse(ContactBase):
    id: UUID
    tenant_id: UUID
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    merged_into_id: UUID | None = None

    model_config = {"from_attributes": True}


class PersonAliasCreate(BaseModel):
    person_id: UUID
    alias: str


class PersonAliasResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    person_id: UUID
    alias: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OverviewCounts(BaseModel):
    interactions: int = 0
    deals: int = 0
    notes: int = 0
    documents: int = 0
    emails: int = 0
    open_tasks: int = 0


class OverviewEvent(BaseModel):
    id: UUID
    kind: str | None = None
    title: str | None = None
    starts_at: datetime
    location: str | None = None
    property_title: str | None = None


class OverviewDeal(BaseModel):
    id: UUID
    pipeline_stage: str | None = None
    property_id: UUID | None = None
    property_title: str | None = None
    expected_value_cents: int | None = None
    currency: str | None = None


class OverviewProperty(BaseModel):
    id: UUID
    title: str


class ContactOverview(BaseModel):
    """Where the relationship stands, in one payload."""

    last_interaction_at: datetime | None = None
    last_interaction_kind: str | None = None
    next_event: OverviewEvent | None = None
    deals: list[OverviewDeal] = []
    #: Every property this person is currently attached to, deals and bookings.
    properties: list[OverviewProperty] = []
    #: The live WhatsApp thread, when there is one.
    conversation_id: UUID | None = None
    #: The contact spoke last and nobody has answered.
    awaiting_reply: bool = False
    counts: OverviewCounts = OverviewCounts()


class ContactPhoneOut(BaseModel):
    id: UUID
    e164: str
    label: str | None = None
    is_primary: bool = False
    verified_at: datetime | None = None


class ContactEmailOut(BaseModel):
    id: UUID
    address: str
    label: str | None = None
    is_primary: bool = False
    verified_at: datetime | None = None


class ContactChannels(BaseModel):
    """Every way to reach a person.

    `contacts.phone` / `.email` are the primary of each list, mirrored by
    trigger for the readers that still expect a scalar column.
    """

    phones: list[ContactPhoneOut] = []
    emails: list[ContactEmailOut] = []


class AddPhoneRequest(BaseModel):
    phone: str
    label: str | None = None
    make_primary: bool = False


class AddEmailRequest(BaseModel):
    email: str
    label: str | None = None
    make_primary: bool = False


class ContactDuplicate(BaseModel):
    """A candidate pair. Detection proposes; a human decides.

    Never a constraint: a couple sharing a phone number is real data, and a
    unique index would reject it.
    """

    contact_id: UUID
    contact_name: str
    duplicate_id: UUID
    duplicate_name: str
    #: Spanish, shown as-is: "mismo teléfono", "mismo RUT".
    reason: str
    score: float


class MergeContactRequest(BaseModel):
    #: The contact that will be folded away.
    loser_id: UUID
