"""Client Agent — B2C AI for inbound WhatsApp from external contacts.

Differs from Anita:
- Sender is the *contact*, not a broker. No propose-pending — direct DB
  writes (lead capture, visit requests) are fine because the contact is
  the actor.
- Conversation lives in ``client_conversations`` / ``client_messages``,
  not ``anita_*``.
- Single LLM call per turn (no two-pass), short reply, Spanish, polite.
- Hand-off: if conversation ``ai_enabled=false`` or ``status='assigned'``,
  do not auto-reply.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.anita.rate_limiter import get_rate_limiter
from app.features.integrations.kapso import client as kapso_client


def _now() -> str:
    return datetime.now(UTC).isoformat()

logger = get_logger("CLIENT_AGENT")


SYSTEM_PROMPT = """\
Eres asistente de {business} (inmobiliaria en Chile). Hablas con un cliente o
prospecto por WhatsApp. Respuestas BREVES (máx 2 frases), tono cercano y profesional,
en español rioplatense neutro. Si pregunta por una propiedad específica, captura los datos
relevantes (presupuesto, comuna, dormitorios) y dile que un asesor humano lo contactará.
Si pide agendar una visita, confirma fecha/hora tentativa y dile que el broker confirma.
Si la consulta es ambigua o requiere decisión humana (precio, oferta, comisión), responde
"Te paso con un asesor en breve" y NO inventes datos.
NO prometas precios, NO confirmes disponibilidad, NO firmes nada en nombre del broker."""


async def handle_inbound_client(
    *,
    phone_e164: str,
    user_text: str,
    external_message_id: str | None,
    external_thread_id: str | None,
    contact_name: str | None = None,
) -> None:
    db = get_supabase_client()

    # Idempotency.
    if external_message_id:
        dup = (
            db.table("client_messages")
            .select("id")
            .eq("external_message_id", external_message_id)
            .limit(1)
            .execute()
            .data
        )
        if dup:
            return

    contact = _ensure_contact_from_phone(phone_e164, contact_name)
    conv = _ensure_conversation(contact, phone_e164, external_thread_id)

    db.table("client_messages").insert(
        {
            "tenant_id": conv["tenant_id"],
            "conversation_id": conv["id"],
            "direction": "inbound",
            "sender_type": "contact",
            "content": user_text,
            "external_message_id": external_message_id,
        }
    ).execute()
    db.table("client_conversations").update(
        {"last_inbound_at": _now(), "last_message_at": _now()}
    ).eq("id", conv["id"]).execute()

    # Auto-record inbound consent (replying counts as opt-in for utility).
    _record_inbound_consent(conv["tenant_id"], contact["id"])

    if not conv.get("ai_enabled", True) or conv.get("status") == "assigned":
        return

    history = _load_history(conv["id"])
    reply = await _generate_reply(history, user_text)
    if not reply:
        return

    msg = (
        db.table("client_messages")
        .insert(
            {
                "tenant_id": conv["tenant_id"],
                "conversation_id": conv["id"],
                "direction": "outbound",
                "sender_type": "agent_ai",
                "content": reply,
                "delivery_status": "queued",
            }
        )
        .execute()
        .data[0]
    )
    try:
        resp = await kapso_client.send_text(phone_e164, reply)
        ext = (resp.get("messages") or [{}])[0].get("id")
        db.table("client_messages").update(
            {"delivery_status": "sent", "external_message_id": ext}
        ).eq("id", msg["id"]).execute()
        db.table("client_conversations").update(
            {"last_message_at": _now()}
        ).eq("id", conv["id"]).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("client_agent_send_failed", event_type="kapso", error=str(exc))
        db.table("client_messages").update(
            {"delivery_status": "failed", "failure_reason": str(exc)[:500]}
        ).eq("id", msg["id"]).execute()


def _ensure_contact_from_phone(
    phone_e164: str,
    contact_name: str | None = None,
) -> dict[str, Any]:
    db = get_supabase_client()
    rows = (
        db.table("contacts")
        .select("id, tenant_id, full_name, phone")
        .eq("phone", phone_e164)
        .limit(1)
        .execute()
        .data
    )
    if rows:
        return rows[0]
    tenant_id = _resolve_default_tenant()
    inserted = (
        db.table("contacts")
        .insert(
            {
                "tenant_id": tenant_id,
                "type": "BUYER",
                "full_name": (contact_name or phone_e164).strip(),
                "phone": phone_e164,
                "metadata": {"channel_origin": "whatsapp"},
            }
        )
        .execute()
        .data[0]
    )
    return inserted


def _resolve_default_tenant() -> str:
    db = get_supabase_client()
    rows = db.table("tenants").select("id").limit(1).execute().data
    if not rows:
        raise RuntimeError("no tenant configured for inbound contact")
    return rows[0]["id"]


def _ensure_conversation(
    contact: dict[str, Any],
    phone_e164: str,
    external_thread_id: str | None,
) -> dict[str, Any]:
    db = get_supabase_client()
    rows = (
        db.table("client_conversations")
        .select("*")
        .eq("contact_id", contact["id"])
        .eq("source", "whatsapp")
        .order("last_message_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if rows:
        return rows[0]
    return (
        db.table("client_conversations")
        .insert(
            {
                "tenant_id": contact["tenant_id"],
                "contact_id": contact["id"],
                "source": "whatsapp",
                "external_thread_id": external_thread_id,
                "external_phone_e164": phone_e164,
                "status": "open",
                "ai_enabled": True,
            }
        )
        .execute()
        .data[0]
    )


def _record_inbound_consent(tenant_id: str, contact_id: str) -> None:
    db = get_supabase_client()
    existing = (
        db.table("client_consents")
        .select("id, opted_in_at")
        .eq("tenant_id", tenant_id)
        .eq("contact_id", contact_id)
        .eq("channel", "whatsapp")
        .limit(1)
        .execute()
        .data
    )
    if existing and existing[0].get("opted_in_at"):
        return
    if existing:
        db.table("client_consents").update(
            {"opted_in_at": _now(), "method": "inbound_reply", "opted_out_at": None}
        ).eq("id", existing[0]["id"]).execute()
    else:
        db.table("client_consents").insert(
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "channel": "whatsapp",
                "opted_in_at": _now(),
                "method": "inbound_reply",
            }
        ).execute()


def _load_history(conversation_id: str) -> list[dict[str, str]]:
    db = get_supabase_client()
    rows = (
        db.table("client_messages")
        .select("direction, content, sender_type, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=True)
        .limit(settings.client_agent_max_history)
        .execute()
        .data
    )
    rows.reverse()
    return [
        {
            "role": "user" if r["direction"] == "inbound" else "assistant",
            "content": r["content"],
        }
        for r in rows
    ]


async def _generate_reply(history: list[dict[str, str]], user_text: str) -> str:
    from openai import AsyncOpenAI

    api_key = settings.groq_api_key
    if settings.client_agent_provider == "openai":
        api_key = settings.openai_api_key
    elif settings.client_agent_provider == "anthropic":
        # Map to Anthropic via OpenAI-compatible would require separate SDK;
        # for now keep Groq/OpenAI compatible providers.
        api_key = settings.groq_api_key

    base_url = "https://api.groq.com/openai/v1"
    if settings.client_agent_provider == "openai":
        base_url = "https://api.openai.com/v1"

    est_tokens = sum(len(m["content"]) for m in history) // 4 + 100
    await get_rate_limiter().acquire(
        settings.client_agent_provider, settings.client_agent_model, est_tokens
    )

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(business=settings.client_agent_business_name)},
        *history,
    ]

    try:
        completion = await client.chat.completions.create(
            model=settings.client_agent_model,
            messages=messages,
            temperature=0.3,
            max_tokens=200,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("client_agent_llm_failed", event_type="llm", error=str(exc))
        return "Gracias por tu mensaje, un asesor te responde a la brevedad."

    text = (completion.choices[0].message.content or "").strip() if completion.choices else ""
    if completion.usage:
        get_rate_limiter().record_response(
            settings.client_agent_provider,
            settings.client_agent_model,
            completion.usage.prompt_tokens + completion.usage.completion_tokens,
            headers={},
        )
    return text or "Gracias, un asesor te responde a la brevedad."
