from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_role
from app.features.geo import service
from app.features.geo.schemas import GeoAutocompleteResponse

router = APIRouter(
    prefix="/geo",
    tags=["geo"],
    dependencies=[Depends(require_role("ADMIN", "AGENT"))],
)


@router.get("/autocomplete", response_model=GeoAutocompleteResponse)
async def autocomplete(
    q: str = Query(min_length=3, max_length=120),
    limit: int = Query(default=6, ge=1, le=10),
) -> GeoAutocompleteResponse:
    """Addresses matching a partial string, biased to Chile.

    Under three characters there is nothing to match on and the provider would
    return the same twenty cities for everyone, so the minimum is enforced
    here rather than debounced away in the client.
    """
    items = await service.autocomplete(q, limit)
    return GeoAutocompleteResponse(items=items, attribution=service.ATTRIBUTION)
