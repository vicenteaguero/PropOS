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
    new_status = event_type.rsplit(".", 1)[-1]
    payload: dict[str, Any] = {"delivery_status": new_status}
    if new_status == "failed":
        err = msg.get("kapso", {}).get("status_error") or msg.get("errors")
        if err:
            payload["failure_reason"] = str(err)[:500]
    db.table("client_messages").update(payload).eq("external_message_id", external_id).execute()
    db.table("anita_messages").update(payload).eq("external_message_id", external_id).execute()


async def _handle_message_batch(items: list[dict[str, Any]]) -> None:
    """Handle a batch of inbound messages grouped by conversation.

    Hands the raw items list to the right adapter (Anita vs Client Agent).
    Per-message multimodal handling (text/audio/image, transcription,
    media buffer) lives inside the adapters since the resolution depends
    on whether the sender is an internal user (Anita session + media buffer)
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
    user_match = _match_internal_user(phone_e164)

    if user_match:
        from app.features.channels.anita_adapter import handle_inbound_anita_batch

        await handle_inbound_anita_batch(
            user_match=user_match,
            items=items,
            phone_e164=phone_e164,
            external_thread_id=external_thread_id,
        )
        return

    # External contact → Client Agent. For now still text-only path: use the
    # original concatenation behaviour. Media for B2C is out of scope for this
    # ship (covered by client_messages.media_url already).
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
