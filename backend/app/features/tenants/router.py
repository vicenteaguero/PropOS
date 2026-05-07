from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_tenant_id, require_role
from app.core.supabase.client import get_supabase_client
from app.features.tenants.schemas import (
    TenantResponse,
    TenantSettings,
    TenantSettingsUpdate,
)

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _hydrate(row: dict) -> TenantResponse:
    settings_json = row.get("settings") or {}
    settings = TenantSettings(
        ai_assistant_name=settings_json.get("ai_assistant_name") or "Anita",
        default_paper_size=settings_json.get("default_paper_size") or "A4",
    )
    return TenantResponse(
        id=UUID(row["id"]),
        name=row["name"],
        slug=row["slug"],
        settings=settings,
    )


@router.get("/me", response_model=TenantResponse)
async def get_my_tenant(tenant_id: UUID = Depends(get_tenant_id)) -> TenantResponse:
    client = get_supabase_client()
    row = client.table("tenants").select("id,name,slug,settings").eq("id", str(tenant_id)).single().execute().data
    if not row:
        raise HTTPException(status_code=404, detail="tenant not found")
    return _hydrate(row)


@router.patch(
    "/me",
    response_model=TenantResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_my_tenant_settings(
    payload: TenantSettingsUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> TenantResponse:
    client = get_supabase_client()
    current = client.table("tenants").select("settings").eq("id", str(tenant_id)).single().execute().data
    settings = dict((current or {}).get("settings") or {})
    if payload.ai_assistant_name is not None:
        settings["ai_assistant_name"] = payload.ai_assistant_name
    if payload.default_paper_size is not None:
        settings["default_paper_size"] = payload.default_paper_size
    if payload.extra:
        settings.update(payload.extra)

    row = client.table("tenants").update({"settings": settings}).eq("id", str(tenant_id)).execute().data[0]
    return _hydrate(row)
