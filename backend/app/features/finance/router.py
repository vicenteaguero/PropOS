from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_tenant_id, require_role
from app.features.finance.calc import DEFAULT_IVA_PCT, commission
from app.features.finance.service import FinanceService

router = APIRouter(
    prefix="/finance",
    tags=["finance"],
    dependencies=[Depends(require_role("ADMIN"))],
)


@router.get("/commission-preview")
async def commission_preview(
    amount_cents: int = Query(..., ge=0),
    rate_pct: float = Query(...),
    iva: bool = Query(default=True),
) -> dict:
    return commission(amount_cents, rate_pct, DEFAULT_IVA_PCT if iva else 0.0)


@router.get("/summary")
async def summary(
    tenant_id: UUID = Depends(get_tenant_id),
    month: str | None = Query(default=None),
) -> dict:
    return await FinanceService.summary(tenant_id, month)
