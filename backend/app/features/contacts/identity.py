"""Channels, duplicates and merging — the identity half of a person.

`contacts.phone` and `contacts.email` are single columns kept as a mirror of
the primary row in `contact_phones` / `contact_emails`. Everything that adds a
channel goes through here; the scalar columns are transitional, and a legacy
writer that still sets them is mirrored back by trigger rather than ignored.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.core.phone import to_e164
from app.core.supabase.client import get_supabase_client
from app.features.contacts.schemas import (
    ContactChannels,
    ContactDuplicate,
    ContactEmailOut,
    ContactPhoneOut,
)


def _client():
    return get_supabase_client()


def _demote_primaries(client, table: str, tenant_id: str, contact_id: str) -> None:
    """Clear the primary flag first: a partial unique index allows exactly one."""
    (
        client.table(table)
        .update({"is_primary": False})
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("is_primary", True)
        .execute()
    )


def list_channels(tenant_id: UUID, contact_id: UUID) -> ContactChannels:
    tid, cid = str(tenant_id), str(contact_id)
    phones = (
        _client()
        .table("contact_phones")
        .select("id,e164,label,is_primary,verified_at")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .order("is_primary", desc=True)
        .order("created_at")
        .execute()
        .data
        or []
    )
    emails = (
        _client()
        .table("contact_emails")
        .select("id,address,label,is_primary,verified_at")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .order("is_primary", desc=True)
        .order("created_at")
        .execute()
        .data
        or []
    )
    return ContactChannels(
        phones=[ContactPhoneOut(**row) for row in phones],
        emails=[ContactEmailOut(**row) for row in emails],
    )


def add_phone(
    tenant_id: UUID,
    contact_id: UUID,
    raw: str,
    label: str | None,
    make_primary: bool,
) -> ContactPhoneOut:
    e164 = to_e164(raw)
    if not e164:
        raise HTTPException(status_code=422, detail="Phone number is not dialable")
    tid, cid = str(tenant_id), str(contact_id)
    client = _client()

    existing = (
        client.table("contact_phones").select("id").eq("tenant_id", tid).eq("contact_id", cid).limit(1).execute().data
    )
    # The first number is primary whether or not the caller asked. A person with
    # channels and no primary leaves `contacts.phone` empty, and every legacy
    # reader of that column goes blind.
    primary = make_primary or not existing
    if primary:
        _demote_primaries(client, "contact_phones", tid, cid)

    row = (
        client.table("contact_phones")
        .upsert(
            {
                "tenant_id": tid,
                "contact_id": cid,
                "e164": e164,
                "label": label,
                "is_primary": primary,
            },
            on_conflict="contact_id,e164",
        )
        .execute()
        .data[0]
    )
    return ContactPhoneOut(**row)


def add_email(
    tenant_id: UUID,
    contact_id: UUID,
    address: str,
    label: str | None,
    make_primary: bool,
) -> ContactEmailOut:
    cleaned = (address or "").strip().lower()
    if "@" not in cleaned:
        raise HTTPException(status_code=422, detail="Not an email address")
    tid, cid = str(tenant_id), str(contact_id)
    client = _client()

    existing = (
        client.table("contact_emails").select("id").eq("tenant_id", tid).eq("contact_id", cid).limit(1).execute().data
    )
    primary = make_primary or not existing
    if primary:
        _demote_primaries(client, "contact_emails", tid, cid)

    already = (
        client.table("contact_emails")
        .select("id")
        .eq("tenant_id", tid)
        .eq("contact_id", cid)
        .eq("address", cleaned)
        .limit(1)
        .execute()
        .data
    )
    if already:
        row = (
            client.table("contact_emails")
            .update({"label": label, "is_primary": primary})
            .eq("id", already[0]["id"])
            .execute()
            .data[0]
        )
    else:
        row = (
            client.table("contact_emails")
            .insert(
                {
                    "tenant_id": tid,
                    "contact_id": cid,
                    "address": cleaned,
                    "label": label,
                    "is_primary": primary,
                }
            )
            .execute()
            .data[0]
        )
    return ContactEmailOut(**row)


def remove_phone(tenant_id: UUID, contact_id: UUID, phone_id: UUID) -> None:
    (
        _client()
        .table("contact_phones")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("contact_id", str(contact_id))
        .eq("id", str(phone_id))
        .execute()
    )


def remove_email(tenant_id: UUID, contact_id: UUID, email_id: UUID) -> None:
    (
        _client()
        .table("contact_emails")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("contact_id", str(contact_id))
        .eq("id", str(email_id))
        .execute()
    )


def find_duplicates(tenant_id: UUID, limit: int) -> list[ContactDuplicate]:
    """Candidate pairs, with the names resolved so a human can judge them."""
    rows = (
        _client().rpc("contacts_find_duplicates", {"p_tenant_id": str(tenant_id), "p_limit": limit}).execute().data
        or []
    )
    if not rows:
        return []

    ids = {row["contact_id"] for row in rows} | {row["duplicate_id"] for row in rows}
    names = {
        row["id"]: row["full_name"]
        for row in (
            _client()
            .table("contacts")
            .select("id,full_name")
            .eq("tenant_id", str(tenant_id))
            .in_("id", list(ids))
            .execute()
            .data
            or []
        )
    }
    return [
        ContactDuplicate(
            contact_id=row["contact_id"],
            contact_name=names.get(row["contact_id"], ""),
            duplicate_id=row["duplicate_id"],
            duplicate_name=names.get(row["duplicate_id"], ""),
            reason=row["reason"],
            score=float(row["score"]),
        )
        for row in rows
    ]


def merge(tenant_id: UUID, winner: UUID, loser: UUID) -> dict[str, Any]:
    """Fold `loser` into `winner`.

    One RPC because it repoints eighteen foreign keys plus two soft pointers,
    and a half-finished merge splits a person's history across two rows with no
    way to tell which half is which. All of it commits, or none of it does.
    """
    if winner == loser:
        raise HTTPException(status_code=422, detail="Cannot merge a contact into itself")
    try:
        _client().rpc(
            "contacts_merge",
            {"p_tenant_id": str(tenant_id), "p_winner": str(winner), "p_loser": str(loser)},
        ).execute()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=409, detail=f"Merge failed: {str(exc)[:200]}") from exc
    return {"merged_into": str(winner), "merged_from": str(loser)}
