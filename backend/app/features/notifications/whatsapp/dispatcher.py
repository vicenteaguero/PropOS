"""Outbound WhatsApp dispatcher.

- Hard-blocks if no opt-in row in ``client_consents``.
- Enforces 24h freeform window: outside window only HSM templates allowed.
- Persists ``client_messages`` row before calling Kapso so realtime UI sees it.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.integrations.kapso import client as kapso_client
from app.features.notifications.whatsapp import templates as tmpl

logger = get_logger("WHATSAPP_DISPATCHER")

WINDOW = timedelta(hours=24)


class ConsentError(RuntimeError):
    pass


class WindowError(RuntimeError):
    pass


def _has_consent(tenant_id: str, contact_id: str) -> bool:
    db = get_supabase_client()
    rows = (
        db.table("client_consents")
        .select("opted_in_at, opted_out_at")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("channel", "whatsapp")
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return False
    row = rows[0]
    return bool(row.get("opted_in_at")) and not row.get("opted_out_at")


def _within_freeform_window(conversation_id: str) -> bool:
    db = get_supabase_client()
    row = (
        db.table("client_conversations")
        .select("last_inbound_at")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
        .data
    )
    if not row or not row[0].get("last_inbound_at"):
        return False
    last = datetime.fromisoformat(str(row[0]["last_inbound_at"]).replace("Z", "+00:00"))
    return datetime.now(UTC) - last < WINDOW


def _ensure_conversation(
    tenant_id: str,
    contact_id: str,
    phone_e164: str,
) -> dict[str, Any]:
    db = get_supabase_client()
    rows = (
        db.table("client_conversations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("source", "whatsapp")
        .order("last_message_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if rows:
        return rows[0]
    inserted = (
        db.table("client_conversations")
        .insert(
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "source": "whatsapp",
                "external_phone_e164": phone_e164,
                "status": "open",
            }
        )
        .execute()
        .data[0]
    )
    return inserted


def _record_outbound(
    tenant_id: str,
    conversation_id: str,
    content: str,
    *,
    template_name: str | None,
    sender_user_id: str | None,
) -> dict[str, Any]:
    db = get_supabase_client()
    return (
        db.table("client_messages")
        .insert(
            {
                "tenant_id": tenant_id,
                "conversation_id": conversation_id,
                "direction": "outbound",
                "sender_type": "agent_human" if sender_user_id else "agent_ai",
                "sender_user_id": sender_user_id,
                "content": content,
                "template_name": template_name,
                "delivery_status": "queued",
            }
        )
        .execute()
        .data[0]
    )


async def send_template_to_contact(
    tenant_id: UUID | str,
    contact_id: UUID | str,
    phone_e164: str,
    template_name: str,
    vars_map: dict[str, str],
    *,
    sender_user_id: str | None = None,
) -> dict[str, Any]:
    tenant_id, contact_id = str(tenant_id), str(contact_id)
    if not _has_consent(tenant_id, contact_id):
        raise ConsentError(f"contact {contact_id} not opted-in for whatsapp")

    template = tmpl.get(template_name)
    rendered_vars = tmpl.render_variables(template, vars_map)

    conv = _ensure_conversation(tenant_id, contact_id, phone_e164)
    body_preview = template.body
    for i, v in enumerate(rendered_vars, start=1):
        body_preview = body_preview.replace(f"{{{{{i}}}}}", v)

    msg_row = _record_outbound(
        tenant_id, conv["id"], body_preview,
        template_name=template_name, sender_user_id=sender_user_id,
    )

    resp = await kapso_client.send_template(
        phone_e164, template.name, rendered_vars, lang=template.language
    )
    _update_status_from_resp(msg_row["id"], resp)
    return {"message_id": msg_row["id"], "kapso": resp}


async def send_freeform_to_conversation(
    tenant_id: UUID | str,
    conversation_id: UUID | str,
    text: str,
    *,
    sender_user_id: str | None = None,
) -> dict[str, Any]:
    tenant_id, conversation_id = str(tenant_id), str(conversation_id)
    db = get_supabase_client()
    conv = (
        db.table("client_conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
        .data
    )
    if not conv:
        raise RuntimeError(f"conversation {conversation_id} not found")
    if conv.get("contact_id") and not _has_consent(tenant_id, conv["contact_id"]):
        raise ConsentError("contact not opted-in")
    if not _within_freeform_window(conversation_id):
        raise WindowError("outside 24h freeform window — use a template")

    phone = conv.get("external_phone_e164")
    if not phone:
        raise RuntimeError("conversation has no external phone")

    msg_row = _record_outbound(
        tenant_id, conversation_id, text,
        template_name=None, sender_user_id=sender_user_id,
    )
    resp = await kapso_client.send_text(phone, text)
    _update_status_from_resp(msg_row["id"], resp)
    return {"message_id": msg_row["id"], "kapso": resp}


def _update_status_from_resp(message_id: str, resp: dict[str, Any]) -> None:
    db = get_supabase_client()
    msgs = (resp.get("messages") or [])
    external_id = msgs[0].get("id") if msgs else None
    db.table("client_messages").update(
        {
            "delivery_status": "sent",
            "external_message_id": external_id,
        }
    ).eq("id", message_id).execute()
