"""Inbound channel router (Kapso v2 payload).

Kapso v2 webhook body:
{
  "type": "whatsapp.message.received" | "...delivered" | "...read" | "...failed",
  "batch": true,
  "data": [
    {
      "message": { "id", "from", "text": {"body"}, "type", ... },
      "conversation": { "id", "phone_number", "contact_name", ... },
      "phone_number_id": "...",
      "is_new_conversation": bool
    },
    ...
  ]
}

Status events use the same envelope but with status fields on the message.
"""

from __future__ import annotations

from typing import Any

from app.core.logging.logger import get_logger
from app.core.dependencies import scope_allows
from app.core.supabase.client import get_supabase_client
from app.features.channels.tenant_routing import (
    TenantRoutingError,
    extract_phone_number_id,
    resolve_tenant_id,
)

logger = get_logger("CHANNEL_ROUTER")


async def route_inbound(body: dict[str, Any]) -> None:
    event_type = body.get("type") or ""
    items = body.get("data") or []

    if event_type == "whatsapp.message.received":
        # Concatenate batched messages from same conversation into one turn.
        for grouped in _group_by_conversation(items):
            await _handle_message_batch(grouped)
        return

    if event_type in {
        "whatsapp.message.delivered",
        "whatsapp.message.read",
        "whatsapp.message.sent",
        "whatsapp.message.failed",
    }:
        for item in items:
            _apply_status(item, event_type)
        return

    logger.info("kapso_unhandled_event", event_type="kapso", type=event_type)


def _group_by_conversation(items: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        conv = (it.get("conversation") or {}).get("id") or "_"
        groups.setdefault(conv, []).append(it)
    return list(groups.values())


def _apply_status(item: dict[str, Any], event_type: str) -> None:
    db = get_supabase_client()
    msg = item.get("message") or {}
    external_id = msg.get("id")
    if not external_id:
        return
    # Scope the write: an unfiltered update by external id can stamp a row of
    # another tenant. Delivery status is telemetry, so an unroutable event is
    # dropped rather than applied instance-wide.
    try:
        tenant_id = resolve_tenant_id(extract_phone_number_id(item))
    except TenantRoutingError as exc:
        logger.warning("kapso_status_unrouted", event_type="kapso", external_id=external_id, error=str(exc))
        return
    new_status = event_type.rsplit(".", 1)[-1]
    payload: dict[str, Any] = {"delivery_status": new_status}
    if new_status == "failed":
        err = msg.get("kapso", {}).get("status_error") or msg.get("errors")
        if err:
            payload["failure_reason"] = str(err)[:500]
    for table in ("client_messages", "agent_messages"):
        db.table(table).update(payload).eq("tenant_id", tenant_id).eq("external_message_id", external_id).execute()


async def _handle_message_batch(items: list[dict[str, Any]]) -> None:
    """Handle a batch of inbound messages grouped by conversation.

    Hands the raw items list to the right adapter (Agent vs Client Agent).
    Per-message multimodal handling (text/audio/image, transcription,
    media buffer) lives inside the adapters since the resolution depends
    on whether the sender is an internal user (Agent session + media buffer)
    or an external contact (client_messages).
    """
    if not items:
        return
    first = items[0]
    msg = first.get("message") or {}
    conv = first.get("conversation") or {}

    raw_phone = msg.get("from") or conv.get("phone_number") or ""
    if not raw_phone:
        return
    phone_e164 = raw_phone if raw_phone.startswith("+") else f"+{raw_phone}"

    external_thread_id = conv.get("id")
    phone_row = _lookup_internal_phone(phone_e164)
    user_match = _eligible_internal_user(phone_row)

    if user_match:
        from app.features.channels.agent_adapter import handle_inbound_agent_batch

        await handle_inbound_agent_batch(
            user_match=user_match,
            items=items,
            phone_e164=phone_e164,
            external_thread_id=external_thread_id,
        )
        return

    if phone_row is not None:
        # A broker's number that failed the agent gate. Stop here instead of
        # falling through: the B2C bot would answer a colleague as if they
        # were a prospect and file them as a contact.
        logger.warning("kapso_internal_phone_not_eligible", event_type="kapso", phone=phone_e164)
        return

    # External contact → Client Agent. The sender's phone says nothing about
    # which inmobiliaria this belongs to; the *receiving* number does.
    try:
        tenant_id = resolve_tenant_id(extract_phone_number_id(first))
    except TenantRoutingError as exc:
        logger.error("kapso_inbound_unrouted", event_type="kapso", phone=phone_e164, error=str(exc))
        return

    # For now still text-only path: use the original concatenation behaviour.
    # Media for B2C is out of scope for this ship (covered by
    # client_messages.media_url already).
    parts: list[str] = []
    external_ids: list[str] = []
    for it in items:
        m = it.get("message") or {}
        t = extract_text(m)
        if t:
            parts.append(t)
        if m.get("id"):
            external_ids.append(m["id"])
    user_text = "\n".join(parts).strip()
    primary_external_id = external_ids[0] if external_ids else None

    if not user_text:
        logger.info("kapso_skip_no_text_external", event_type="kapso", count=len(items))
        return

    from app.features.channels.client_agent import handle_inbound_client

    await handle_inbound_client(
        tenant_id=tenant_id,
        phone_e164=phone_e164,
        user_text=user_text,
        external_message_id=primary_external_id,
        external_thread_id=external_thread_id,
        contact_name=conv.get("contact_name"),
    )


def classify_message(msg: dict[str, Any]) -> str:
    """Return one of: 'text' | 'audio' | 'image' | 'unknown'."""
    t = (msg.get("type") or "").lower()
    if t in {"text", "audio", "image"}:
        return t
    # Kapso sometimes wraps under .kapso.content_type or omits type when only
    # audio/image is sent. Best-effort fallback.
    if msg.get("audio") or msg.get("voice"):
        return "audio"
    if msg.get("image"):
        return "image"
    if (msg.get("text") or {}).get("body") or msg.get("kapso", {}).get("content"):
        return "text"
    return "unknown"


def extract_text(msg: dict[str, Any]) -> str | None:
    if classify_message(msg) == "text":
        return (msg.get("text") or {}).get("body") or msg.get("kapso", {}).get("content")
    return None


def extract_media_id(msg: dict[str, Any], kind: str) -> str | None:
    if kind == "audio":
        return (msg.get("audio") or msg.get("voice") or {}).get("id")
    if kind == "image":
        return (msg.get("image") or {}).get("id")
    return None


def is_forwarded(msg: dict[str, Any]) -> bool:
    ctx = msg.get("context") or {}
    return bool(ctx.get("forwarded") or ctx.get("frequently_forwarded"))


def _lookup_internal_phone(phone_e164: str) -> dict[str, Any] | None:
    """The ``user_phones`` row for this number, verified or not."""
    db = get_supabase_client()
    rows = (
        db.table("user_phones")
        .select("user_id, tenant_id, phone_e164, verified_at")
        .eq("phone_e164", phone_e164)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _eligible_internal_user(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Keep only rows allowed to drive Propo.

    A match bypasses the agent router's ``require_role("ADMIN")`` +
    ``require_scope("agent")`` gate, so the same conditions are re-checked
    against the phone's own tenant: the number must be verified and the user
    must be an active ADMIN holding the ``agent`` scope.
    """
    if not row:
        return None
    if not row.get("verified_at"):
        logger.warning(
            "kapso_internal_phone_unverified",
            event_type="kapso",
            user_id=row.get("user_id"),
            tenant_id=row.get("tenant_id"),
        )
        return None
    if not _has_agent_access(row["user_id"], row["tenant_id"]):
        logger.warning(
            "kapso_internal_user_denied",
            event_type="kapso",
            user_id=row["user_id"],
            tenant_id=row["tenant_id"],
        )
        return None
    return row


def _match_internal_user(phone_e164: str) -> dict[str, Any] | None:
    return _eligible_internal_user(_lookup_internal_phone(phone_e164))


def _has_agent_access(user_id: str, tenant_id: str) -> bool:
    """Active ADMIN membership in ``tenant_id`` with the ``agent`` scope."""
    db = get_supabase_client()
    rows = (
        db.table("tenant_memberships")
        .select("role, admin_scope, is_active")
        .eq("user_id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        # Pre-membership rows: fall back to the denormalized profile snapshot.
        rows = (
            db.table("profiles")
            .select("role, admin_scope, is_active")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
            .data
        )
    if not rows:
        return False
    row = rows[0]
    if row.get("is_active") is False:
        return False
    if row.get("role") != "ADMIN":
        return False
    # The one implementation of the scope convention, shared with the HTTP
    # dependency. This used to be a second copy of the rule, which is how an
    # authorization convention drifts.
    return scope_allows(row.get("admin_scope"), "agent")
