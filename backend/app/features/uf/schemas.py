from __future__ import annotations

from datetime import date as date_t

from pydantic import BaseModel


class UfPoint(BaseModel):
    date: date_t
    value_clp: float
    # Which provider supplied the row (sii.cl / cmf.cl / mindicador.cl).
    source: str | None = None


class UfTodayResponse(BaseModel):
    today: UfPoint
    month_delta_pct: float | None
    year_delta_pct: float | None


class UfForwardResponse(BaseModel):
    """Officially published UF values dated after today (not projections)."""

    points: list[UfPoint]


class UsdTodayResponse(BaseModel):
    """Observed USD/CLP reference rate, fetched server-side rather than by the browser."""

    date: date_t
    value_clp: float
    source: str = "mindicador.cl"


class UfRefreshResponse(BaseModel):
    today: UfPoint
    inserted: bool
    backfilled_count: int
