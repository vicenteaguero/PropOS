"""The per-tenant catalog of event types.

Reads live on the events router (every broker's calendar needs them); writes
live behind the ADMIN gate in `settings/router.py`, next to the other catalogs.
The split is deliberate — a type is configuration, but a calendar that cannot
name its own types is not a calendar.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.core.db import run_blocking
from app.core.supabase.client import get_supabase_client

TABLE = "event_types"
FIELDS = "id,tenant_id,key,label,color,icon,behavior,position,active,is_system"


def _client():
    return get_supabase_client()


def _rows(tenant_id: UUID, *, only_active: bool = False) -> list[dict[str, Any]]:
    builder = _client().table(TABLE).select(FIELDS).eq("tenant_id", str(tenant_id))
    if only_active:
        builder = builder.eq("active", True)
    return builder.order("position").order("label").execute().data or []


async def list_types(tenant_id: UUID, *, only_active: bool = False) -> list[dict[str, Any]]:
    return await run_blocking(lambda: _rows(tenant_id, only_active=only_active))


def create_type(tenant_id: UUID, payload) -> dict[str, Any]:
    values = payload.model_dump()
    values["tenant_id"] = str(tenant_id)
    try:
        rows = _client().table(TABLE).insert(values).execute().data or []
    except Exception as exc:  # UNIQUE (tenant_id, key)
        if "duplicate key" in str(exc) or "23505" in str(exc):
            raise HTTPException(status_code=409, detail="An event type with that key already exists") from exc
        raise
    if not rows:
        raise HTTPException(status_code=500, detail="Event type was not created")
    return rows[0]


def update_type(tenant_id: UUID, type_id: UUID, payload) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")
    rows = (
        _client().table(TABLE).update(values).eq("tenant_id", str(tenant_id)).eq("id", str(type_id)).execute().data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Event type not found")
    return rows[0]


def delete_type(tenant_id: UUID, type_id: UUID) -> None:
    """Deactivates rather than deletes when events already carry the key.

    `events.kind` holds the key as text with no foreign key, so a hard delete
    would leave every event of that type rendering as an unknown label. The
    five system types cannot be removed at all — the RLS policy also refuses.
    """
    rows = (
        _client()
        .table(TABLE)
        .select("key,is_system")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(type_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Event type not found")
    if rows[0].get("is_system"):
        raise HTTPException(status_code=409, detail="System event types cannot be deleted")

    in_use = (
        _client()
        .table("events")
        .select("id", count="exact")
        .eq("tenant_id", str(tenant_id))
        .eq("kind", rows[0]["key"])
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    if (in_use.count or 0) > 0:
        _client().table(TABLE).update({"active": False}).eq("tenant_id", str(tenant_id)).eq(
            "id", str(type_id)
        ).execute()
        return

    _client().table(TABLE).delete().eq("tenant_id", str(tenant_id)).eq("id", str(type_id)).execute()
