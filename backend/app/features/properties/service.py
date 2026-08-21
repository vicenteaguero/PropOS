from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.properties.publish import assert_publishable
from app.features.properties.photos import PropertyPhotoService

PROPERTIES_TABLE = "properties"

logger = get_logger("PROPERTIES")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        elif hasattr(v, "value"):
            out[k] = v.value
        else:
            out[k] = v
    return out


class PropertyService:
    @staticmethod
    async def list_properties(
        tenant_id: UUID,
        query: str | None = None,
        include_drafts: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        client = get_supabase_client()
        logger.info("listing", event_type="query", tenant_id=str(tenant_id))
        # Always bounded: an unlimited select is truncated at db-max-rows with
        # no error, so the caller can't tell a short page from the whole table.
        builder = (
            client.table(PROPERTIES_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if not include_drafts:
            builder = builder.eq("is_draft", False)
        if query:
            builder = builder.ilike("title", f"%{query}%")
        rows = builder.execute().data or []
        # Attach covers here rather than letting the grid call the per-property
        # photo endpoint: that was one request and ~6 sign calls per card.
        covers = await PropertyPhotoService.covers_for_properties([UUID(r["id"]) for r in rows], tenant_id)
        for row in rows:
            row["cover_url"] = covers.get(row["id"])
        return rows

    @staticmethod
    async def get_property(property_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        response = (
            client.table(PROPERTIES_TABLE)
            .select("*")
            .eq("id", str(property_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def create_property(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _serialize(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        response = client.table(PROPERTIES_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def update_property(property_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _serialize(payload.model_dump(exclude_unset=True))

        # Publishing is the one transition with consequences outside the app:
        # a listing that leaves draft can be syndicated and seen. Check it
        # against the row AS IT WILL BE, so setting the price and publishing in
        # the same request is allowed.
        if data.get("is_draft") is False:
            current = (
                client.table(PROPERTIES_TABLE)
                .select("*")
                .eq("id", str(property_id))
                .eq("tenant_id", str(tenant_id))
                .single()
                .execute()
                .data
            ) or {}
            if current.get("is_draft"):
                assert_publishable(client, tenant_id, property_id, {**current, **data})

        response = (
            client.table(PROPERTIES_TABLE)
            .update(data)
            .eq("id", str(property_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_property(property_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (client.table(PROPERTIES_TABLE).delete().eq("id", str(property_id)).eq("tenant_id", str(tenant_id)).execute())

    @staticmethod
    async def get_building_context(tenant_id: UUID, property_id: UUID) -> dict | None:
        """The building this property is in, and its other units. None when it is
        a standalone house, which is most of them."""
        client = get_supabase_client()
        rows = (
            client.table("properties")
            .select("building_id")
            .eq("tenant_id", str(tenant_id))
            .eq("id", str(property_id))
            .limit(1)
            .execute()
            .data
        )
        building_id = rows[0].get("building_id") if rows else None
        if not building_id:
            return None

        buildings = (
            client.table("buildings")
            .select("id,name,address,comuna,year_built,shared")
            .eq("tenant_id", str(tenant_id))
            .eq("id", building_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
            .data
        )
        if not buildings:
            return None

        units = (
            client.table("properties")
            .select("id,title,unit_label,status,list_price_cents,area_sqm")
            .eq("tenant_id", str(tenant_id))
            .eq("building_id", building_id)
            .neq("id", str(property_id))
            .is_("deleted_at", "null")
            .order("unit_label")
            .limit(50)
            .execute()
            .data
            or []
        )
        return {**buildings[0], "units": units}

    @staticmethod
    async def get_price_history(tenant_id: UUID, property_id: UUID) -> list[dict]:
        """Every recorded price and status change, newest first.

        The trigger has been writing these since `20240101000027` and nothing
        ever read them — a broker asking "how long has this been at this price"
        had the answer in the database and no way to see it.
        """
        client = get_supabase_client()
        current = (
            client.table(PROPERTIES_TABLE)
            .select("list_price_cents,status")
            .eq("tenant_id", str(tenant_id))
            .eq("id", str(property_id))
            .limit(1)
            .execute()
            .data
        )
        if not current:
            return []

        snapshots = (
            client.table("property_snapshots")
            .select("snapshot_at,trigger,snapshot_data")
            .eq("tenant_id", str(tenant_id))
            .eq("property_id", str(property_id))
            .order("snapshot_at", desc=True)
            .limit(50)
            .execute()
            .data
            or []
        )

        # Walk newest → oldest. Each snapshot holds the value BEFORE its change,
        # so the value AFTER it is whatever the next-newer snapshot recorded as
        # its own "before" — and for the newest, the live row.
        after = current[0]
        entries: list[dict] = []
        for snap in snapshots:
            before = snap.get("snapshot_data") or {}
            entries.append(
                {
                    "at": snap["snapshot_at"],
                    "trigger": snap["trigger"],
                    "price_from_cents": before.get("list_price_cents"),
                    "price_to_cents": after.get("list_price_cents"),
                    "status_from": before.get("status"),
                    "status_to": after.get("status"),
                }
            )
            after = before
        return entries
