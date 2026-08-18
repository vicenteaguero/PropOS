"""Resolve which tenant owns an inbound WhatsApp message.

Kapso puts ``phone_number_id`` — the id of the *receiving* WhatsApp number —
on every webhook item. For an external contact that id is the only
trustworthy tenant hint: the sender's phone belongs to the prospect, not to
an inmobiliaria, so matching contacts by phone across the whole instance
lets the first tenant that ever saved that number capture the conversation.

The mapping lives in ``tenants.settings->>'kapso_phone_number_id'``. An
instance with a single tenant needs no mapping because there is nothing to
disambiguate. Anything else raises: dropping a prospect into an arbitrary
tenant is worse than dropping the message.
"""

from __future__ import annotations

from typing import Any

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("CHANNEL_TENANT")

SETTINGS_PHONE_KEY = "kapso_phone_number_id"


class TenantRoutingError(RuntimeError):
    """Inbound message cannot be attributed to exactly one tenant."""


def extract_phone_number_id(item: dict[str, Any]) -> str | None:
    """Pull the receiving number's id out of a Kapso webhook item."""
    candidates = (
        item.get("phone_number_id"),
        (item.get("conversation") or {}).get("phone_number_id"),
        (item.get("metadata") or {}).get("phone_number_id"),
        (item.get("message") or {}).get("phone_number_id"),
    )
    for candidate in candidates:
        if candidate:
            return str(candidate)
    return None


def resolve_tenant_id(phone_number_id: str | None) -> str:
    """Return the tenant that owns ``phone_number_id``.

    Raises ``TenantRoutingError`` when the receiving number maps to zero or
    to several tenants and the instance has more than one tenant to choose
    from.
    """
    db = get_supabase_client()

    if phone_number_id:
        rows = (
            db.table("tenants")
            .select("id")
            .eq(f"settings->>{SETTINGS_PHONE_KEY}", phone_number_id)
            .limit(2)
            .execute()
            .data
        ) or []
        if len(rows) == 1:
            return str(rows[0]["id"])
        if len(rows) > 1:
            raise TenantRoutingError(f"phone_number_id {phone_number_id} maps to more than one tenant")

    # No explicit mapping. Safe only while the instance holds one tenant:
    # there is a single possible owner, so nothing is being guessed.
    tenants = db.table("tenants").select("id").limit(2).execute().data or []
    if len(tenants) == 1:
        logger.warning(
            "kapso_tenant_mapping_missing",
            event_type="kapso",
            phone_number_id=phone_number_id,
            hint=f"set tenants.settings->>{SETTINGS_PHONE_KEY} before adding a second tenant",
        )
        return str(tenants[0]["id"])

    raise TenantRoutingError(
        f"no tenant mapped to phone_number_id {phone_number_id!r} and {len(tenants)} tenants exist"
    )
