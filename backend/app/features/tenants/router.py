from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user, get_tenant_id, require_dev_admin, require_role
from app.core.supabase.client import get_supabase_client
from app.features.tenants.schemas import (
    TenantAdminResponse,
    TenantCreate,
    TenantResponse,
    TenantSettings,
    TenantSettingsUpdate,
    TenantUpdate,
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


# ---------- admin CRUD ----------


admin_router = APIRouter(prefix="/admin/tenants", tags=["tenants-admin"])


@admin_router.get("", response_model=list[TenantAdminResponse], dependencies=[Depends(require_role("ADMIN"))])
async def list_tenants(current_user: dict[str, Any] = Depends(get_current_user)) -> list[dict]:
    client = get_supabase_client()
    if current_user.get("is_dev_admin"):
        rows = client.table("tenants").select("id,name,slug,is_active,created_at").order("created_at").execute().data
    else:
        # Non-dev admin: only tenants where they have a membership.
        memberships = (
            client.table("tenant_memberships")
            .select("tenant_id")
            .eq("user_id", current_user["id"])
            .eq("is_active", True)
            .execute()
            .data
        )
        ids = [m["tenant_id"] for m in memberships]
        if not ids:
            return []
        rows = (
            client.table("tenants")
            .select("id,name,slug,is_active,created_at")
            .in_("id", ids)
            .order("created_at")
            .execute()
            .data
        )

    out = []
    for r in rows:
        member_count = (
            client.table("tenant_memberships")
            .select("user_id", count="exact")
            .eq("tenant_id", r["id"])
            .eq("is_active", True)
            .execute()
            .count
            or 0
        )
        property_count = (
            client.table("properties").select("id", count="exact").eq("tenant_id", r["id"]).execute().count or 0
        )
        out.append(
            {
                **r,
                "member_count": member_count,
                "property_count": property_count,
            }
        )
    return out


@admin_router.post(
    "",
    response_model=TenantAdminResponse,
    status_code=201,
    dependencies=[Depends(require_dev_admin)],
)
async def create_tenant(
    payload: TenantCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    client = get_supabase_client()
    existing = client.table("tenants").select("id").eq("slug", payload.slug).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="slug already in use")
    row = client.table("tenants").insert({"name": payload.name, "slug": payload.slug}).execute().data[0]
    # Auto-membership for the creator.
    client.table("tenant_memberships").insert(
        {
            "user_id": current_user["id"],
            "tenant_id": row["id"],
            "role": "ADMIN",
            "admin_scope": [],
            "is_dev_admin": True,
            "view": "admin-dev",
        }
    ).execute()
    return {**row, "is_active": True, "member_count": 1, "property_count": 0}


@admin_router.patch(
    "/{tenant_id}",
    response_model=TenantAdminResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_tenant(
    tenant_id: UUID,
    payload: TenantUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    client = get_supabase_client()
    data = payload.model_dump(exclude_unset=True)
    # Slug change is dev-only.
    if "slug" in data and not current_user.get("is_dev_admin"):
        raise HTTPException(status_code=403, detail="Slug change requires dev admin")
    row = client.table("tenants").update(data).eq("id", str(tenant_id)).execute().data[0]
    return {**row, "member_count": 0, "property_count": 0}


@admin_router.delete(
    "/{tenant_id}",
    status_code=204,
    dependencies=[Depends(require_dev_admin)],
)
async def soft_delete_tenant(tenant_id: UUID):
    client = get_supabase_client()
    client.table("tenants").update({"is_active": False}).eq("id", str(tenant_id)).execute()
