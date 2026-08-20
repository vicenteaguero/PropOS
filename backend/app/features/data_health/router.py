from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id
from app.features.data_health.schemas import DataHealth
from app.features.data_health.service import check_tenant

router = APIRouter(prefix="/data-health", tags=["data-health"])


@router.get("", response_model=DataHealth)
async def data_health(tenant_id: UUID = Depends(get_tenant_id)) -> DataHealth:
    """Rows the database accepts but the business cannot use."""
    return check_tenant(tenant_id)
