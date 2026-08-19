"""Observed USD/CLP reference rate, fetched server-side.

The frontend used to call `https://mindicador.cl/api/dolar` straight from the
browser — the only third-party request the client made. That leaked every
broker's IP and usage pattern to a service we don't control, gave us no cache
and no fallback, and would have broken the widget outright if mindicador ever
tightened its CORS headers. The UF next to it already went through this API;
this brings the dollar in line.

Kept deliberately small: no persistence, no backfill, no provider chain. The
dollar here is a glanceable reference beside the UF, not a figure the product
computes with, so an in-process TTL cache is the right amount of machinery.
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import Any

import httpx

from app.core.logging.logger import get_logger
from app.features.uf.providers.base import HTTP_TIMEOUT, SANTIAGO

logger = get_logger("UF")

MINDICADOR_USD = "https://mindicador.cl/api/dolar"

# The observed rate is published once per business day, so a short TTL is
# plenty; it exists to collapse the herd of clients booting each morning into
# one upstream call, not to serve stale data.
CACHE_TTL_SECONDS = 15 * 60

# Sanity band. USD/CLP has traded roughly 400–1200 for two decades; this is wide
# enough to survive a currency crisis while still catching a parser that picked
# up a date, an index or a percentage.
MIN_PLAUSIBLE_CLP = 100.0
MAX_PLAUSIBLE_CLP = 10_000.0


class UsdFetchError(RuntimeError):
    """The upstream rate could not be fetched or parsed into a usable value."""


_cache: tuple[float, date, float] | None = None  # (fetched_at_monotonic, date, value)
_lock = asyncio.Lock()


def _parse(body: dict[str, Any]) -> tuple[date, float]:
    serie = body.get("serie") or []
    if not serie:
        raise UsdFetchError("mindicador: empty dolar series")
    entry = serie[0]
    try:
        # "2026-08-18T04:00:00.000Z" style strings.
        d = datetime.fromisoformat(str(entry["fecha"]).replace("Z", "+00:00")).date()
        value = float(entry["valor"])
    except (KeyError, TypeError, ValueError) as exc:
        raise UsdFetchError(f"mindicador: unparseable dolar entry: {exc}") from exc

    if not MIN_PLAUSIBLE_CLP <= value <= MAX_PLAUSIBLE_CLP:
        raise UsdFetchError(f"mindicador: implausible USD/CLP value {value}")
    return d, value


async def get_usd_today(*, force: bool = False) -> tuple[date, float]:
    """Today's USD/CLP, from cache when warm. Raises `UsdFetchError` on failure."""
    global _cache

    now = asyncio.get_running_loop().time()
    if not force and _cache and now - _cache[0] < CACHE_TTL_SECONDS:
        return _cache[1], _cache[2]

    async with _lock:
        # Re-check: a concurrent caller may have filled the cache while we waited.
        if not force and _cache and asyncio.get_running_loop().time() - _cache[0] < CACHE_TTL_SECONDS:
            return _cache[1], _cache[2]

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                resp = await client.get(MINDICADOR_USD)
                resp.raise_for_status()
                body = resp.json()
        except httpx.HTTPError as exc:
            raise UsdFetchError(f"mindicador: request failed: {exc}") from exc
        except ValueError as exc:
            raise UsdFetchError("mindicador: response was not JSON") from exc

        d, value = _parse(body)
        _cache = (asyncio.get_running_loop().time(), d, value)
        logger.info("usd_fetched", date=str(d), value_clp=value)
        return d, value


def today_santiago() -> date:
    """Chile-local today, matching the UF service's notion of the current day."""
    return datetime.now(SANTIAGO).date()
