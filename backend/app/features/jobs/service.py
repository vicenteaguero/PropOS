"""Internal job runners, triggered by Cloud Scheduler.

These run with the service-role client (no per-request tenant) and must
therefore scope every query explicitly. Each runner is idempotent so a
duplicate scheduler fire (at-least-once) is harmless.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import anyio

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.notifications.service import send_push

logger = get_logger("JOBS")

# How many reminders one run may claim. An unbounded claim would flip the whole
# backlog to SENDING and then time out mid-way through the fan-out.
CLAIM_BATCH = 200
# A SENDING row older than this lost its runner (deploy, OOM, timeout) and is
# re-queued: without it those reminders are invisible to every later run.
STUCK_AFTER_MINUTES = 10
# Transient push failures (network, VAPID hiccup) must not burn the reminder.
SEND_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 1.0


def _recover_stuck(client, now: datetime) -> int:
    """Return reminders abandoned mid-send to PENDING."""
    cutoff = (now - timedelta(minutes=STUCK_AFTER_MINUTES)).isoformat()
    rows = (
        client.table("reminders")
        .update({"status": "PENDING"})
        .eq("status", "SENDING")
        .lt("updated_at", cutoff)
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )
    if rows:
        logger.warning("reminders_recovered", event_type="job", recovered=len(rows))
    return len(rows)


def _claim_due(client, now: str) -> list[dict[str, Any]]:
    """Claim-first, bounded: flip PENDING→SENDING for one batch of due rows.

    The flip is a single filtered UPDATE, so a concurrent run (at-least-once
    scheduler delivery) can't double-send — its ``status='PENDING'`` filter no
    longer matches.
    """
    due = (
        client.table("reminders")
        .select("id")
        .eq("status", "PENDING")
        .lte("remind_at", now)
        .is_("deleted_at", "null")
        .order("remind_at")
        .limit(CLAIM_BATCH)
        .execute()
        .data
        or []
    )
    if not due:
        return []
    return (
        client.table("reminders")
        .update({"status": "SENDING"})
        .in_("id", [row["id"] for row in due])
        .eq("status", "PENDING")
        .execute()
        .data
        or []
    )


async def _send_with_retries(reminder: dict[str, Any]) -> Exception | None:
    """Push the reminder, retrying transient failures. None on success."""
    last_error: Exception | None = None
    for attempt in range(1, SEND_ATTEMPTS + 1):
        try:
            await send_push(
                tenant_id=reminder["tenant_id"],
                title="Recordatorio",
                body=reminder.get("message") or "Tenés un recordatorio pendiente",
                user_id=reminder["user_id"],
                url=reminder.get("url") or "/",
            )
            return None
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning(
                "reminder_push_retry",
                event_type="job",
                reminder_id=reminder["id"],
                attempt=attempt,
                error=str(exc)[:200],
            )
            if attempt < SEND_ATTEMPTS:
                await anyio.sleep(RETRY_BACKOFF_SECONDS * attempt)
    return last_error


async def run_due_reminders() -> dict[str, int]:
    """Send any PENDING reminders whose ``remind_at`` has passed."""
    client = get_supabase_client()
    started = datetime.now(UTC)

    recovered = _recover_stuck(client, started)
    claimed = _claim_due(client, started.isoformat())

    sent = 0
    failed = 0
    for r in claimed:
        error = await _send_with_retries(r)
        if error is None:
            client.table("reminders").update({"status": "SENT", "sent_at": datetime.now(UTC).isoformat()}).eq(
                "id", r["id"]
            ).execute()
            sent += 1
        else:
            client.table("reminders").update(
                {"status": "FAILED", "error": f"{SEND_ATTEMPTS} intentos: {str(error)[:270]}"}
            ).eq("id", r["id"]).execute()
            failed += 1

    logger.info(
        "run_due_reminders",
        event_type="job",
        claimed=len(claimed),
        recovered=recovered,
        sent=sent,
        failed=failed,
    )
    return {"sent": sent, "failed": failed, "recovered": recovered, "claimed": len(claimed)}

