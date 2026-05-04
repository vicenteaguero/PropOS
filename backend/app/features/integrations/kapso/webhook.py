"""Kapso webhook receiver.

Public endpoint (no JWT). HMAC-SHA256 verified. Persists raw event to
``kapso_webhook_events`` and hands message events to the channel router.

Critical: must return 200 within 10s or Kapso retries. Heavy work (LLM
calls) goes to a BackgroundTasks queue.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.integrations.kapso import signature

logger = get_logger("KAPSO_WEBHOOK")

router = APIRouter(prefix="/integrations/kapso", tags=["kapso-webhook"])


@router.post("/webhook")
async def kapso_webhook(
    request: Request,
    background: BackgroundTasks,
    x_webhook_signature: str | None = Header(default=None),
    x_idempotency_key: str | None = Header(default=None),
    x_webhook_event: str | None = Header(default=None),
    x_webhook_batch: str | None = Header(default=None),
    x_batch_size: str | None = Header(default=None),
) -> dict[str, Any]:
    raw = await request.body()

    valid = signature.verify(settings.kapso_webhook_secret, raw, x_webhook_signature)
    if not valid:
        # Still log invalid attempts for forensics, but reject.
        _persist_event(raw, valid=False, external_event_id=x_idempotency_key, event_type=None)
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        body = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid json") from None

    event_type = x_webhook_event or body.get("type") or _detect_event_type(body)
    # Kapso v2 puts event type only in header, not body — inject so router sees it.
    if event_type and not body.get("type"):
        body["type"] = event_type
    event_row = _persist_event(
        raw,
        valid=True,
        external_event_id=x_idempotency_key,
        event_type=event_type,
        body=body,
    )
    if event_row is None:
        # Duplicate (unique-violation on external_event_id) — already processed.
        return {"status": "duplicate"}

    background.add_task(_process_event, event_row["id"], body)
    return {"status": "accepted"}


def _detect_event_type(body: dict[str, Any]) -> str | None:
    events = body.get("events") or {}
    if events.get("messages"):
        return "messages"
    if events.get("statuses"):
        return "statuses"
    if events.get("calls"):
        return "calls"
    if events.get("contacts"):
        return "contacts"
    return body.get("type")


def _persist_event(
    raw: bytes,
    *,
    valid: bool,
    external_event_id: str | None,
    event_type: str | None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    client = get_supabase_client()
    payload = body if body is not None else {"_raw_b64": raw.hex()}
    row = {
        "external_event_id": external_event_id,
        "signature_valid": valid,
        "event_type": event_type,
        "payload": payload,
    }
    try:
        result = client.table("kapso_webhook_events").insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as exc:
        msg = str(exc).lower()
        if "duplicate" in msg or "unique" in msg or "23505" in msg:
            return None
        logger.warning("kapso_persist_failed", event_type="kapso", error=str(exc))
        return None


async def _process_event(event_row_id: str, body: dict[str, Any]) -> None:
    """Background dispatch — keep webhook 200 fast."""
    from datetime import UTC, datetime

    from app.features.channels.router import route_inbound

    client = get_supabase_client()
    try:
        await route_inbound(body)
        client.table("kapso_webhook_events").update(
            {"processed_at": datetime.now(UTC).isoformat()}
        ).eq("id", event_row_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("kapso_event_processing_failed", event_type="kapso")
        client.table("kapso_webhook_events").update(
            {"process_error": str(exc)[:500]}
        ).eq("id", event_row_id).execute()
