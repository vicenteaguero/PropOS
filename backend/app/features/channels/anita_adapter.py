"""Drive Anita's run_chat_turn from a WhatsApp inbound message.

Anita expects an SSE consumer; here we drain the async iterator, collect
text events, persist with source='whatsapp', and reply via Kapso.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.anita.chat import run_chat_turn
from app.features.integrations.kapso import client as kapso_client

logger = get_logger("ANITA_WHATSAPP")


async def handle_inbound_anita(
    *,
    user_match: dict[str, Any],
    user_text: str,
    phone_e164: str,
    external_message_id: str | None,
    external_thread_id: str | None,
) -> None:
    db = get_supabase_client()
    tenant_id = user_match["tenant_id"]
    user_id = user_match["user_id"]

    # Idempotency: bail if we've already recorded this inbound.
    if external_message_id:
        dup = (
            db.table("anita_messages")
            .select("id")
            .eq("external_message_id", external_message_id)
            .eq("source", "whatsapp")
            .limit(1)
            .execute()
            .data
        )
        if dup:
            return

    session = _ensure_whatsapp_session(tenant_id, user_id, external_thread_id)

    # Tag the inbound message with source/external id BEFORE Anita runs,
    # so unique index protects against double-processing.
    db.table("anita_messages").insert(
        {
            "tenant_id": tenant_id,
            "session_id": session["id"],
            "role": "user",
            "content": {"text": user_text},
            "source": "whatsapp",
            "external_message_id": external_message_id,
        }
    ).execute()

    assistant_text = ""
    async for event in run_chat_turn(
        session_id=UUID(session["id"]),
        tenant_id=UUID(tenant_id),
        user_id=UUID(user_id),
        user_text=user_text,
    ):
        if event.get("type") == "text":
            assistant_text = event.get("text") or assistant_text

    if not assistant_text:
        assistant_text = "Listo."

    try:
        resp = await kapso_client.send_text(phone_e164, assistant_text)
        _record_outbound_anita(tenant_id, session["id"], assistant_text, resp)
    except Exception as exc:  # noqa: BLE001
        logger.exception("anita_whatsapp_send_failed", event_type="kapso", error=str(exc))


def _ensure_whatsapp_session(
    tenant_id: str,
    user_id: str,
    external_thread_id: str | None,
) -> dict[str, Any]:
    db = get_supabase_client()
    rows = (
        db.table("anita_sessions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .eq("source", "whatsapp")
        .eq("status", "OPEN")
        .order("last_activity_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if rows:
        return rows[0]
    return (
        db.table("anita_sessions")
        .insert(
            {
                "id": str(uuid4()),
                "tenant_id": tenant_id,
                "user_id": user_id,
                "status": "OPEN",
                "source": "whatsapp",
                "external_thread_id": external_thread_id,
            }
        )
        .execute()
        .data[0]
    )


def _record_outbound_anita(
    tenant_id: str,
    session_id: str,
    text: str,
    kapso_resp: dict[str, Any],
) -> None:
    db = get_supabase_client()
    msgs = kapso_resp.get("messages") or []
    external_id = msgs[0].get("id") if msgs else None
    # The Anita run_chat_turn already inserted the assistant turn for SSE;
    # we add a sibling row tagged with channel metadata for delivery tracking.
    db.table("anita_messages").insert(
        {
            "tenant_id": tenant_id,
            "session_id": session_id,
            "role": "assistant",
            "content": [{"type": "text", "text": text}],
            "source": "whatsapp",
            "external_message_id": external_id,
            "delivery_status": "sent",
        }
    ).execute()
