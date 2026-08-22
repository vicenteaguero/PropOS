"""Read the tenant's feature states; write them as dev admin.

The read is deliberately ungated beyond authentication: every signed-in user
needs the map in order to draw a locked feature AS locked. Hiding the map would
only mean the app cannot explain itself.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_tenant_id, require_dev_admin
from app.core.features import BY_KEY, CATALOG, resolve_states, set_state
from app.features.feature_flags.schemas import FeatureCatalogItem, FeatureStateWrite

router = APIRouter(prefix="/features", tags=["features"])
admin_router = APIRouter(prefix="/admin/features", tags=["features-admin"])


@router.get("")
async def list_features(tenant_id: UUID = Depends(get_tenant_id)) -> dict[str, Any]:
    return resolve_states(tenant_id)


@admin_router.get("/catalog", response_model=list[FeatureCatalogItem])
async def feature_catalog(_: dict[str, Any] = Depends(require_dev_admin)) -> list[dict]:
    return [{"key": f.key, "label_es": f.label_es, "scope": f.scope} for f in CATALOG]


@admin_router.put("/{key}")
async def put_feature_state(
    key: str,
    payload: FeatureStateWrite,
    current_user: dict[str, Any] = Depends(require_dev_admin),
) -> dict[str, Any]:
    if key not in BY_KEY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown feature key: {key}",
        )
    return set_state(
        key,
        payload.state,
        tenant_id=payload.tenant_id,
        note=payload.note,
        updated_by=current_user["id"],
    )
