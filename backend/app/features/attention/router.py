from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_tenant_id
from app.features.attention.schemas import AttentionFeed
from app.features.attention.service import build_feed

router = APIRouter(prefix="/attention", tags=["attention"])


@router.get("", response_model=AttentionFeed)
async def attention(
    limit: int = Query(default=50, ge=1, le=200),
    tenant_id: UUID = Depends(get_tenant_id),
) -> AttentionFeed:
    """Everything waiting on a person, ranked by how soon it stops being fixable.

    Deliberately ungated, like `/data-health`: it returns nothing the caller
    cannot already read through the per-feature list endpoints, and gating it
    per source would make rows appear and disappear from one queue with no
    explanation on screen. RLS still scopes every query to the caller's tenant.
    """
    return build_feed(tenant_id, limit)
