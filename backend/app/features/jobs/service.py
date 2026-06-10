"""Internal job runners, triggered by Cloud Scheduler.

These run with the service-role client (no per-request tenant) and must
therefore scope every query explicitly. Each runner is idempotent so a
duplicate scheduler fire (at-least-once) is harmless.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.notifications.service import send_push

logger = get_logger("JOBS")


async def run_due_reminders() -> dict[str, int]:
    """Send any PENDING reminders whose ``remind_at`` has passed.

    Claim-first: flip PENDING→SENDING in a single filtered UPDATE so a
    concurrent run (at-least-once scheduler delivery) can't double-send —
    the second run's ``status='PENDING'`` filter no longer matches.
    """
    client = get_supabase_client()
    now = datetime.now(UTC).isoformat()

    claimed = (
        client.table("reminders")
        .update({"status": "SENDING"})
        .eq("status", "PENDING")
        .lte("remind_at", now)
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )

    sent = 0
    failed = 0
    for r in claimed:
        try:
            await send_push(
                tenant_id=r["tenant_id"],
                title="Recordatorio",
                body=r.get("message") or "Tenés un recordatorio pendiente",
                user_id=r["user_id"],
                url=r.get("url") or "/",
            )
            client.table("reminders").update(
                {"status": "SENT", "sent_at": datetime.now(UTC).isoformat()}
            ).eq("id", r["id"]).execute()
            sent += 1
        except Exception as exc:  # noqa: BLE001
            client.table("reminders").update({"status": "FAILED", "error": str(exc)[:300]}).eq(
                "id", r["id"]
            ).execute()
            failed += 1

    logger.info("run_due_reminders", event_type="job", claimed=len(claimed), sent=sent, failed=failed)
    return {"sent": sent, "failed": failed}
