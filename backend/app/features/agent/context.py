from __future__ import annotations

import threading
import time
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


# The snapshot costs 9 sequential PostgREST round-trips, and it sat on the hot
# path of every turn (voice included). Cache it per tenant with a short TTL —
# same shape as `text_to_sql._SCHEMA_CACHE`. Writes made by the agent call
# `invalidate_snapshot` so the next turn sees the row it just created.
_SNAPSHOT_TTL_SECONDS = 60.0
_SNAPSHOT_CACHE_MAX = 64
_snapshot_cache: dict[str, tuple[float, TenantSnapshot]] = {}
_snapshot_lock = threading.Lock()


def invalidate_snapshot(tenant_id: UUID | str | None = None) -> None:
    """Drop the cached snapshot so the next ``load_snapshot`` refetches.

    Called after the agent writes a row: the resolver reads the snapshot, so a
    contact created this turn must be visible on the next one.
    """
    with _snapshot_lock:
        if tenant_id is None:
            _snapshot_cache.clear()
        else:
            _snapshot_cache.pop(str(tenant_id), None)


def load_snapshot(tenant_id: UUID, *, force_refresh: bool = False) -> TenantSnapshot:
    """Load tenant context for Agent's system prompt.

    Cached in-process per tenant for ``_SNAPSHOT_TTL_SECONDS``; pass
    ``force_refresh=True`` to bypass.
    """
    key = str(tenant_id)
    now = time.monotonic()

    if not force_refresh:
        with _snapshot_lock:
            hit = _snapshot_cache.get(key)
        if hit is not None and (now - hit[0]) < _SNAPSHOT_TTL_SECONDS:
            return hit[1]

    snapshot = _fetch_snapshot(tenant_id)

    with _snapshot_lock:
        if len(_snapshot_cache) >= _SNAPSHOT_CACHE_MAX:
            stale = [k for k, (at, _) in _snapshot_cache.items() if (now - at) >= _SNAPSHOT_TTL_SECONDS]
            for k in stale:
                _snapshot_cache.pop(k, None)
            if len(_snapshot_cache) >= _SNAPSHOT_CACHE_MAX:
                _snapshot_cache.clear()
        _snapshot_cache[key] = (now, snapshot)
    return snapshot


def _fetch_snapshot(tenant_id: UUID) -> TenantSnapshot:
    client = get_supabase_client()
    tid = str(tenant_id)

    tenant = client.table("tenants").select("name").eq("id", tid).single().execute().data

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
        pipelines=client.table("pipelines").select("name,stages").eq("tenant_id", tid).limit(5).execute().data,
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
