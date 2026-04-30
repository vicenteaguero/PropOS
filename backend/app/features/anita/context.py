from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client


@dataclass
class TenantSnapshot:
    tenant_id: UUID
    tenant_name: str = ""
    user_count: int = 0
    projects: list[dict[str, Any]] = field(default_factory=list)
    people: list[dict[str, Any]] = field(default_factory=list)
    properties: list[dict[str, Any]] = field(default_factory=list)
    organizations: list[dict[str, Any]] = field(default_factory=list)
    pipelines: list[dict[str, Any]] = field(default_factory=list)
    tags: list[dict[str, Any]] = field(default_factory=list)
    recent_interactions: list[dict[str, Any]] = field(default_factory=list)
    recent_transactions: list[dict[str, Any]] = field(default_factory=list)


def load_snapshot(tenant_id: UUID) -> TenantSnapshot:
    """Load tenant context for Anita's system prompt.

    Cached in-process per session in chat.py (one snapshot per session, not turn).
    """
    client = get_supabase_client()
    tid = str(tenant_id)

    tenant = (
        client.table("tenants").select("name").eq("id", tid).single().execute().data
    )

    return TenantSnapshot(
        tenant_id=tenant_id,
        tenant_name=tenant.get("name", "") if tenant else "",
        projects=client.table("projects")
        .select("id,name,kind,status")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(30)
        .execute()
        .data,
        people=client.table("contacts")
        .select("id,full_name,type,phone,email")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(30)
        .execute()
        .data,
        properties=client.table("properties")
        .select("id,title,status,address")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("updated_at", desc=True)
        .limit(30)
        .execute()
        .data,
        organizations=client.table("organizations")
        .select("id,name,kind")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("name")
        .limit(30)
        .execute()
        .data,
        pipelines=client.table("pipelines")
        .select("name,stages")
        .eq("tenant_id", tid)
        .limit(5)
        .execute()
        .data,
        tags=client.table("tags").select("name").eq("tenant_id", tid).limit(30).execute().data,
        recent_interactions=client.table("interactions")
        .select("occurred_at,kind,summary")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("occurred_at", desc=True)
        .limit(10)
        .execute()
        .data,
        recent_transactions=client.table("transactions")
        .select("occurred_at,direction,category,amount_cents,description")
        .eq("tenant_id", tid)
        .is_("deleted_at", "null")
        .order("occurred_at", desc=True)
        .limit(10)
        .execute()
        .data,
    )
