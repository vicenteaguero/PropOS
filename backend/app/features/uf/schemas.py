from __future__ import annotations

from datetime import date as date_t

from pydantic import BaseModel


class UfPoint(BaseModel):
    date: date_t
    value_clp: float


class UfTodayResponse(BaseModel):
    today: UfPoint
    month_delta_pct: float | None
    year_delta_pct: float | None


class UfRefreshResponse(BaseModel):
    today: UfPoint
    inserted: bool
    backfilled_count: int
