"""Temporary "watch this" marks on a person or a property.

The attention queue ranks by rules — a WhatsApp window, a visit's hour, a task's
due date. Those rules are right on average and blind to what the broker knows: a
deal about to fall over, a client who called the office angry. A flag is how
that knowledge gets into the ranking, for two days, without editing any record.

Shared across the workspace and attributed: everyone sees it, it says whose it
is, and anyone can take it, extend it or clear it.
"""

from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

TABLE = "attention_flags"

#: How long a flag lasts unless the caller says otherwise. Two days is the
#: window in which "I have to watch this" is still true; past that it is a
#: property of the deal, not of the week, and belongs in the record.
DEFAULT_HOURS = 48


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def list_flags(tenant_id: UUID) -> list[dict[str, Any]]:
    """Every flag that has not expired. Expiry is a column, never a sweeper."""
    return (
        get_supabase_client()
        .table(TABLE)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .gt("expires_at", _now().isoformat())
        .execute()
        .data
        or []
    )


def flagged_ids(tenant_id: UUID) -> tuple[set[str], set[str]]:
    """`(contact_ids, property_ids)` currently flagged. Used by the queue."""
    contacts: set[str] = set()
    properties: set[str] = set()
    for row in list_flags(tenant_id):
        if row.get("contact_id"):
            contacts.add(row["contact_id"])
        if row.get("property_id"):
            properties.add(row["property_id"])
    return contacts, properties


def set_flag(
    tenant_id: UUID,
    *,
    target_kind: str,
    target_id: UUID,
    user_id: UUID,
    hours: int = DEFAULT_HOURS,
    note: str | None = None,
) -> dict[str, Any]:
    """Flag a target, or extend the flag that is already on it.

    Upsert rather than insert: the unique index is per target, and "flag it
    again" is what a broker does when two days were not enough. Extending keeps
    the original author — the mark says who raised it, and re-raising it is not
    a new opinion.
    """
    client = get_supabase_client()
    column = "contact_id" if target_kind == "CONTACT" else "property_id"
    expires_at = (_now() + dt.timedelta(hours=hours)).isoformat()

    existing = (
        client.table(TABLE)
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq(column, str(target_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        updated = (
            client.table(TABLE)
            .update({"expires_at": expires_at, "note": note})
            .eq("id", existing[0]["id"])
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return updated.data[0]

    inserted = (
        client.table(TABLE)
        .insert(
            {
                "tenant_id": str(tenant_id),
                "target_kind": target_kind,
                column: str(target_id),
                "note": note,
                "created_by": str(user_id),
                "expires_at": expires_at,
            }
        )
        .execute()
    )
    return inserted.data[0]


def clear_flag(tenant_id: UUID, *, target_kind: str, target_id: UUID) -> None:
    column = "contact_id" if target_kind == "CONTACT" else "property_id"
    get_supabase_client().table(TABLE).delete().eq("tenant_id", str(tenant_id)).eq(column, str(target_id)).execute()
