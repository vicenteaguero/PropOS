from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.dependencies import get_current_user, require_role
from app.features.uf.schemas import (
    UfForwardResponse,
    UfPoint,
    UfRefreshResponse,
    UfTodayResponse,
    UsdTodayResponse,
)
from app.features.uf.service import (
    UfFetchError,
    backfill_missing,
    ensure_today,
    get_forward,
    get_today_with_deltas,
)
from app.features.uf.usd import UsdFetchError, get_usd_today

# UF is an internal-tools widget. Reading it is staff-only; refreshing it hits
# an external API and schedules a backfill, so that stays ADMIN-only.
router = APIRouter(
    prefix="/uf",
    tags=["uf"],
    dependencies=[Depends(require_role("ADMIN", "AGENT"))],
)


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


@router.get("/forward", response_model=UfForwardResponse)
async def get_uf_forward(_=Depends(get_current_user)) -> UfForwardResponse:
    """UF values already published for dates after today.

    The Banco Central fixes the whole 10th -> 9th window in advance, so these
    are official figures a broker can quote for a future closing or lease
    adjustment. Empty list is a valid answer (nothing published ahead yet, or
    the active provider does not expose the forward block).
    """
    return UfForwardResponse(points=[UfPoint(**p) for p in get_forward()])


@router.get("/usd-today", response_model=UsdTodayResponse)
async def get_usd(_=Depends(get_current_user)) -> UsdTodayResponse:
    """Observed USD/CLP, shown beside the UF.

    Exists so the browser stops calling mindicador.cl directly: that was the
    client's only third-party request, and it exposed every broker's IP to a
    service outside our control with no cache and no fallback.
    """
    try:
        d, value = await get_usd_today()
    except UsdFetchError as exc:
        raise HTTPException(status_code=503, detail=f"usd fetch failed: {exc}") from exc
    return UsdTodayResponse(date=d, value_clp=value)


@router.post(
    "/refresh",
    response_model=UfRefreshResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
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
