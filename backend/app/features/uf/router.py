from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.dependencies import get_current_user
from app.features.uf.schemas import UfPoint, UfRefreshResponse, UfTodayResponse
from app.features.uf.service import (
    UfFetchError,
    backfill_missing,
    ensure_today,
    get_today_with_deltas,
)

router = APIRouter(prefix="/uf", tags=["uf"])


@router.get("/today", response_model=UfTodayResponse)
async def get_uf_today(_=Depends(get_current_user)) -> UfTodayResponse:
    snapshot = get_today_with_deltas()
    if not snapshot:
        raise HTTPException(status_code=404, detail="no UF data yet — call POST /uf/refresh")
    return UfTodayResponse(
        today=UfPoint(**snapshot["today"]),
        month_delta_pct=snapshot["month_delta_pct"],
        year_delta_pct=snapshot["year_delta_pct"],
    )


@router.post("/refresh", response_model=UfRefreshResponse)
async def refresh_uf(
    background_tasks: BackgroundTasks,
    _=Depends(get_current_user),
) -> UfRefreshResponse:
    """Idempotent: ensures today's row + schedules backfill in background.

    Safe to call from every authenticated client on app boot — concurrent
    callers UPSERT the same row.
    """
    try:
        d, value, inserted = await ensure_today()
    except UfFetchError as exc:
        raise HTTPException(status_code=503, detail=f"uf fetch failed: {exc}") from exc

    background_tasks.add_task(_run_backfill_safe)
    return UfRefreshResponse(
        today=UfPoint(date=d, value_clp=value),
        inserted=inserted,
        backfilled_count=0,
    )


async def _run_backfill_safe() -> None:
    try:
        await backfill_missing()
    except Exception:  # noqa: BLE001 — best-effort, log and move on
        from app.core.logging.logger import get_logger

        get_logger("UF").exception("uf_backfill_failed")
