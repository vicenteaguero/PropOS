"""Internal job runners, triggered by Cloud Scheduler.

These run with the service-role client (no per-request tenant) and must
therefore scope every query explicitly. Each runner is idempotent so a
duplicate scheduler fire (at-least-once) is harmless.
"""

from __future__ import annotations

from app.core.logging.logger import get_logger

logger = get_logger("JOBS")


async def run_due_reminders() -> dict[str, int]:
    """Send any reminders whose ``remind_at`` has passed.

    No-op until the reminders table lands in P3; wired here so the Cloud
    Scheduler job and auth path can be deployed independently.
    """
    logger.info("run_due_reminders", event_type="job", note="no-op until reminders feature")
    return {"sent": 0, "failed": 0}
