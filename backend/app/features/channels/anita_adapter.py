"""Drive Anita's run_chat_turn from a WhatsApp inbound message.

Anita expects an SSE consumer; here we drain the async iterator, collect
text events, persist with source='whatsapp', and reply via Kapso.

Multimodal: audio is transcribed via our Whisper pipeline (same provider
chain Anita uses in PWA voice notes) and treated as text. Images land in
an unprocessed media buffer keyed to the session — Anita acts on them
only when a follow-up text intent consumes the buffer.
"""
from __future__ import annotations

import io
import mimetypes
import uuid as _uuid
from typing import Any
from uuid import UUID, uuid4

from datetime import UTC, datetime, timedelta

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.anita.chat import run_chat_turn
from app.features.anita.transcribe import transcribe_audio
from app.features.channels.router import (
    classify_message,
    extract_media_id,
    extract_text,
    is_forwarded,
)
from app.features.integrations.kapso import client as kapso_client

logger = get_logger("ANITA_WHATSAPP")

MEDIA_BUCKET = "media"


async def handle_inbound_anita_batch(
    *,
    user_match: dict[str, Any],
    items: list[dict[str, Any]],
    phone_e164: str,
    external_thread_id: str | None,
) -> None:
    """Handle a batch of inbound messages (mixed text/audio/image) for Anita.

    - Text bodies + audio transcriptions are concatenated into a single
      ``run_chat_turn`` invocation (one classifier call per batch).
    - Images go into the unprocessed buffer; if no text/audio came along
      Anita just acks the photos and waits.
    """
    db = get_supabase_client()
    tenant_id = user_match["tenant_id"]
    user_id = user_match["user_id"]
    session = _ensure_whatsapp_session(tenant_id, user_id, external_thread_id)
    session_id = session["id"]

    text_parts: list[str] = []
    primary_external_id: str | None = None
    image_count = 0
    audio_count = 0

    for it in items:
        msg = it.get("message") or {}
        ext_id = msg.get("id")
        if ext_id and primary_external_id is None:
            primary_external_id = ext_id

        # Per-message idempotency: if any row already has this external id
        # tagged as whatsapp, we've processed it before.
        if ext_id:
            dup = (
                db.table("anita_messages")
                .select("id")
                .eq("external_message_id", ext_id)
                .eq("source", "whatsapp")
                .limit(1)
                .execute()
                .data
            )
            if dup:
                continue

        kind = classify_message(msg)
        forwarded = is_forwarded(msg)

        if kind == "text":
            body = extract_text(msg) or ""
            if not body:
                continue
            db.table("anita_messages").insert({
                "tenant_id": tenant_id,
                "session_id": session_id,
                "role": "user",
                "content": {"text": body},
                "source": "whatsapp",
                "external_message_id": ext_id,
                "is_forwarded": forwarded,
            }).execute()
            text_parts.append(body)
            continue

        if kind == "audio":
            media_id = extract_media_id(msg, "audio")
            if not media_id:
                logger.warning("kapso_audio_no_media_id", event_type="kapso")
                continue
            try:
                blob, mime = await kapso_client.download_media(media_id)
            except Exception as exc:  # noqa: BLE001
                logger.exception("kapso_audio_download_failed", event_type="kapso", error=str(exc))
                continue
            transcription = _transcribe(blob, mime, tenant_id=UUID(tenant_id))
            db.table("anita_messages").insert({
                "tenant_id": tenant_id,
                "session_id": session_id,
                "role": "user",
                "content": {"text": transcription or "[audio sin transcripción]"},
                "source": "whatsapp",
                "external_message_id": ext_id,
                "is_forwarded": forwarded,
                "media_kapso_id": media_id,
                "media_mime": mime,
                "transcription": transcription,
            }).execute()
            if transcription:
                text_parts.append(transcription)
            audio_count += 1
            continue

        if kind == "image":
            media_id = extract_media_id(msg, "image")
            if not media_id:
                logger.warning("kapso_image_no_media_id", event_type="kapso")
                continue
            try:
                blob, mime = await kapso_client.download_media(media_id)
            except Exception as exc:  # noqa: BLE001
                logger.exception("kapso_image_download_failed", event_type="kapso", error=str(exc))
                continue
            media_url = _store_media(
                blob, mime,
                tenant_id=tenant_id, session_id=session_id, message_id=str(_uuid.uuid4()),
            )
            db.table("anita_messages").insert({
                "tenant_id": tenant_id,
                "session_id": session_id,
                "role": "user",
                "content": {"text": "[imagen]"},
                "source": "whatsapp",
                "external_message_id": ext_id,
                "is_forwarded": forwarded,
                "media_kapso_id": media_id,
                "media_mime": mime,
                "media_url": media_url,
                "media_status": "unprocessed",
            }).execute()
            image_count += 1
            continue

        logger.info("kapso_unhandled_message_type", event_type="kapso", kind=kind)

    user_text = "\n".join(p for p in text_parts if p).strip()

    if not user_text:
        # Pure media batch (likely images alone). Send a single Spanish ack so
        # the user knows photos arrived and Anita is awaiting instructions.
        if image_count > 0:
            ack = (
                "📷 Recibí la foto, dime qué hago con ella."
                if image_count == 1
                else f"📷 Recibí {image_count} fotos, dime qué hago con ellas."
            )
            try:
                resp = await kapso_client.send_text(phone_e164, ack)
                _record_outbound_anita(tenant_id, session_id, ack, resp)
            except Exception as exc:  # noqa: BLE001
                logger.exception("anita_whatsapp_ack_failed", event_type="kapso", error=str(exc))
        return

    # Drain Anita's SSE generator and send the assistant reply.
    assistant_text = ""
    async for event in run_chat_turn(
        session_id=UUID(session_id),
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
        _record_outbound_anita(tenant_id, session_id, assistant_text, resp)
    except Exception as exc:  # noqa: BLE001
        logger.exception("anita_whatsapp_send_failed", event_type="kapso", error=str(exc))


def _transcribe(blob: bytes, mime: str, *, tenant_id: UUID) -> str | None:
    ext = mimetypes.guess_extension(mime) or ".ogg"
    filename = f"audio{ext}"
    try:
        result = transcribe_audio(io.BytesIO(blob), filename=filename, tenant_id=tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("anita_whatsapp_transcribe_failed", event_type="kapso", error=str(exc))
        return None
    text = (result.get("text") or "").strip()
    return text or None


def _store_media(
    blob: bytes,
    mime: str,
    *,
    tenant_id: str,
    session_id: str,
    message_id: str,
) -> str | None:
    """Upload bytes to Supabase Storage. Returns public URL or None on error."""
    db = get_supabase_client()
    ext = (mimetypes.guess_extension(mime) or ".bin").lstrip(".")
    path = f"anita/{tenant_id}/{session_id}/{message_id}.{ext}"
    try:
        db.storage.from_(MEDIA_BUCKET).upload(
            path, blob, {"content-type": mime, "upsert": "true"}
        )
        return db.storage.from_(MEDIA_BUCKET).get_public_url(path)
    except Exception as exc:  # noqa: BLE001
        logger.exception("anita_whatsapp_store_failed", event_type="kapso", error=str(exc))
        return None


# ---------- Legacy entrypoint (kept for any callers; thin wrapper) ----------


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
    """Resolve the Anita session for an inbound WhatsApp from a broker.

    Reuse the most recent OPEN ``source='whatsapp'`` session whose
    ``last_activity_at`` is within ``ANITA_SESSION_INACTIVITY_HOURS`` (default
    4h). Older sessions are left as-is (still OPEN, but a new one starts so
    bursts of messages don't pile into stale threads).
    """
    db = get_supabase_client()
    cutoff = (
        datetime.now(UTC) - timedelta(hours=settings.anita_session_inactivity_hours)
    ).isoformat()
    rows = (
        db.table("anita_sessions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .eq("source", "whatsapp")
        .eq("status", "OPEN")
        .gte("last_activity_at", cutoff)
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
