from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id, require_feature
from app.features.attention.schemas import AttentionFeed, AttentionKind
from app.features.attention.service import build_feed

router = APIRouter(
    prefix="/attention",
    tags=["attention"],
    dependencies=[Depends(require_feature("conversaciones"))],
)


@router.get("", response_model=AttentionFeed)
async def attention(
    limit: int = Query(default=50, ge=1, le=200),
    kinds: list[AttentionKind] | None = Query(
        default=None,
        description="Restrict to these kinds. Omit for everything.",
    ),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
) -> AttentionFeed:
    """Everything waiting on a person, ranked by how soon it stops being fixable.

    Deliberately ungated, like `/data-health`: it returns nothing the caller
    cannot already read through the per-feature list endpoints, and gating it
    per source would make rows appear and disappear from one queue with no
    explanation on screen. RLS still scopes every query to the caller's tenant.
    """
    return await build_feed(
        tenant_id,
        limit,
        kinds=set(kinds) if kinds else None,
        user_id=UUID(str(current_user["id"])),
    )
