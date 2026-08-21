from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.db import gather_blocking, run_blocking
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
    return await run_blocking(search_entities, tenant_id, kind, q, limit)


@router.get("/entities/multi", response_model=list[EntityHit])
async def list_entities_multi(
    kind: list[EntityKind] = Query(description="Record types to search, repeated"),
    q: str | None = Query(default=None, description="Free-text filter"),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=50),
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[EntityHit]:
    """Search several record types at once, in one request.

    The command palette wants people, properties and messages for every term
    the user types. As three separate calls that was three round trips per
    keystroke-after-debounce, each re-running the whole per-request auth chain,
    and the palette showed nothing until the slowest returned. Here the kinds
    are searched concurrently and answered together.

    Results are returned in the order the kinds were requested, so the caller
    controls precedence without having to re-sort.
    """
    kinds = list(dict.fromkeys(kind))
    results = await gather_blocking(*[(lambda k=k: search_entities(tenant_id, k, q, limit)) for k in kinds])
    return [hit for group in results for hit in group]
