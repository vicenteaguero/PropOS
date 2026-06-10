"""Internal cron endpoints. Authenticated by a shared secret header, NOT by a
user JWT — they are invoked by Cloud Scheduler, not the browser.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config.settings import settings
from app.features.jobs import service

router = APIRouter(prefix="/internal/jobs", tags=["internal-jobs"])


def _verify_internal_key(x_internal_key: str | None) -> None:
    secret = settings.internal_jobs_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal jobs not configured",
        )
    if x_internal_key != secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid internal key")


@router.post("/run-due-reminders")
async def run_due_reminders(x_internal_key: str | None = Header(default=None)) -> dict[str, int]:
    _verify_internal_key(x_internal_key)
    return await service.run_due_reminders()


@router.post("/email-sync")
async def email_sync(x_internal_key: str | None = Header(default=None)) -> dict[str, int]:
    _verify_internal_key(x_internal_key)
    from app.features.email_sync.sync import run_all_active_accounts

    return await run_all_active_accounts()
