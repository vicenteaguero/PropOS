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
from app.core.supabase.client import get_supabase_client

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
    new_status = event_type.rsplit(".", 1)[-1]  # delivered|read|sent|failed
    payload: dict[str, Any] = {"delivery_status": new_status}
    if new_status == "failed":
        err = msg.get("kapso", {}).get("status_error") or msg.get("errors")
        if err:
            payload["failure_reason"] = str(err)[:500]
    db.table("client_messages").update(payload).eq(
        "external_message_id", external_id
    ).execute()
    db.table("anita_messages").update(payload).eq(
        "external_message_id", external_id
    ).execute()


async def _handle_message_batch(items: list[dict[str, Any]]) -> None:
    """Handle a batch of inbound messages grouped by conversation.

    Concatenates text content into a single user turn so the AI agent
    replies once instead of N times.
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

    # Concatenate all text bodies in the batch
    parts: list[str] = []
    external_ids: list[str] = []
    for it in items:
        m = it.get("message") or {}
        t = _extract_text(m)
        if t:
            parts.append(t)
        if m.get("id"):
            external_ids.append(m["id"])
    user_text = "\n".join(parts).strip()
    if not user_text:
        logger.info("kapso_skip_no_text", event_type="kapso", count=len(items))
        return

    primary_external_id = external_ids[0] if external_ids else None
    external_thread_id = conv.get("id")

    user_match = _match_internal_user(phone_e164)

    if user_match:
        from app.features.channels.anita_adapter import handle_inbound_anita

        await handle_inbound_anita(
            user_match=user_match,
            user_text=user_text,
            phone_e164=phone_e164,
            external_message_id=primary_external_id,
            external_thread_id=external_thread_id,
        )
        return

    from app.features.channels.client_agent import handle_inbound_client

    await handle_inbound_client(
        phone_e164=phone_e164,
        user_text=user_text,
        external_message_id=primary_external_id,
        external_thread_id=external_thread_id,
        contact_name=conv.get("contact_name"),
    )


def _extract_text(msg: dict[str, Any]) -> str | None:
    if msg.get("type") == "text":
        return (msg.get("text") or {}).get("body")
    # Fallback: Kapso also exposes content at message.kapso.content
    return msg.get("kapso", {}).get("content") or (msg.get("text") or {}).get("body")


def _match_internal_user(phone_e164: str) -> dict[str, Any] | None:
    db = get_supabase_client()
    rows = (
        db.table("user_phones")
        .select("user_id, tenant_id, phone_e164")
        .eq("phone_e164", phone_e164)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None
