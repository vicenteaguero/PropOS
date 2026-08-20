from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_tenant_id
from app.features.search.schemas import EntityHit, EntityKind
from app.features.search.service import DEFAULT_LIMIT, search_entities

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/entities", response_model=list[EntityHit])
async def list_entities(
    kind: EntityKind = Query(description="Record type to search"),
    q: str | None = Query(default=None, description="Free-text filter"),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=50),
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[EntityHit]:
    """Search one record type and return picker-ready {kind, id, label, sub}.

    No `require_scope` here on purpose: this returns nothing a caller cannot
    already read through the per-feature list endpoints, and gating it per kind
    would make a picker's tabs appear and disappear per user with no explanation
    on screen. RLS still scopes every query to the caller's tenant.
    """
    return search_entities(tenant_id, kind, q, limit)
