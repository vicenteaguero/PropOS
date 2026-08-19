"""mindicador.cl provider — free JSON mirror of the Banco Central series.

Keyless and reliable, which makes it the default fallback. Its limitation is
coverage: `/api/uf` returns the last ~10 days and `/api/uf/<year>` stops at
today, so it can never supply the published forward block.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from app.features.uf.providers.base import (
    HTTP_TIMEOUT,
    UfProvider,
    UfProviderError,
    UfSeries,
    validate_series,
)

MINDICADOR_BASE = "https://mindicador.cl/api/uf"


class MindicadorProvider(UfProvider):
    name = "mindicador.cl"

    async def fetch_year(self, year: int) -> UfSeries:
        return await self._get(f"{MINDICADOR_BASE}/{year}")

    async def fetch_recent(self) -> UfSeries:
        return await self._get(MINDICADOR_BASE)

    async def _get(self, url: str) -> UfSeries:
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                body: dict[str, Any] = resp.json()
        except httpx.HTTPError as exc:
            raise UfProviderError(f"mindicador: request failed: {exc}") from exc
        except ValueError as exc:
            raise UfProviderError("mindicador: response was not JSON") from exc

        points: UfSeries = []
        for entry in body.get("serie") or []:
            try:
                # "2026-08-18T04:00:00.000Z" style strings.
                d = datetime.fromisoformat(str(entry["fecha"]).replace("Z", "+00:00")).date()
                value = float(entry["valor"])
            except (KeyError, TypeError, ValueError):
                continue
            points.append((d, value))
        return validate_series(points, source=self.name)
