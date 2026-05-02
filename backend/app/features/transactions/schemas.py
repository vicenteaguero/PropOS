from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class TransactionDirection(str, Enum):
    IN = "IN"
    OUT = "OUT"


class TransactionCategory(str, Enum):
    AD_SPEND = "AD_SPEND"
    COMMISSION = "COMMISSION"
    RENT = "RENT"
    UTILITY = "UTILITY"
    SALARY = "SALARY"
    NOTARY_FEE = "NOTARY_FEE"
    MARKETING = "MARKETING"
    SOFTWARE = "SOFTWARE"
    TAX = "TAX"
    REIMBURSEMENT = "REIMBURSEMENT"
    SALE_PROCEEDS = "SALE_PROCEEDS"
    DEPOSIT = "DEPOSIT"
    REFUND = "REFUND"
    TRANSFER = "TRANSFER"
    OTHER = "OTHER"


class TransactionBase(BaseModel):
    direction: TransactionDirection
    category: TransactionCategory = TransactionCategory.OTHER
    amount_cents: int
    currency: str = "CLP"
    occurred_at: datetime | None = None
    description: str | None = None
    vendor_org_id: UUID | None = None
    payer_person_id: UUID | None = None
    related_property_id: UUID | None = None
    related_project_id: UUID | None = None
    related_campaign_id: UUID | None = None
    receipt_document_id: UUID | None = None
    metadata: dict[str, Any] = {}


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    direction: TransactionDirection | None = None
    category: TransactionCategory | None = None
    amount_cents: int | None = None
    currency: str | None = None
    occurred_at: datetime | None = None
    description: str | None = None
    vendor_org_id: UUID | None = None
    payer_person_id: UUID | None = None
    related_property_id: UUID | None = None
    related_project_id: UUID | None = None
    related_campaign_id: UUID | None = None
    receipt_document_id: UUID | None = None
    metadata: dict[str, Any] | None = None


class TransactionResponse(TransactionBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionSummaryQuery(BaseModel):
    direction: TransactionDirection | None = None
    category: TransactionCategory | None = None
    project_id: UUID | None = None
    campaign_id: UUID | None = None
    month_from: str | None = None
    month_to: str | None = None
