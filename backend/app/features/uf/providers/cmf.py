"""CMF provider — api.cmfchile.cl (ex-SBIF), the regulator's official JSON API.

Same numbers as SII, delivered as JSON instead of a scrapable page, and it also
carries the published forward block. Requires a free API key
(https://api.cmfchile.cl); without `CMF_API_KEY` the provider declines
immediately so the chain moves on without burning a request.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import httpx

from app.core.config.settings import settings
from app.features.uf.providers.base import (
    HTTP_TIMEOUT,
    UfProvider,
    UfProviderError,
    UfSeries,
    parse_clp,
    validate_series,
)

CMF_BASE = "https://api.cmfchile.cl/api-sbifv3/recursos_api/uf"


class CmfProvider(UfProvider):
    name = "cmf.cl"

    async def fetch_year(self, year: int) -> UfSeries:
        return await self._get(f"{CMF_BASE}/{year}")

    async def fetch_recent(self) -> UfSeries:
        # `/uf` returns the current day only; the year page is what carries the
        # forward block, and it is the same single request.
        return await self.fetch_year(datetime.now().year)

    async def _get(self, url: str) -> UfSeries:
        api_key = settings.cmf_api_key
        if not api_key:
            raise UfProviderError("cmf: CMF_API_KEY not configured")
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                resp = await client.get(url, params={"apikey": api_key, "formato": "json"})
        except httpx.HTTPError as exc:
            raise UfProviderError(f"cmf: request failed: {exc}") from exc

        if resp.status_code == 404:
            return []  # year not published
        if resp.status_code >= 400:
            raise UfProviderError(f"cmf: HTTP {resp.status_code}")

        try:
            body: dict[str, Any] = resp.json()
        except ValueError as exc:
            raise UfProviderError("cmf: response was not JSON") from exc

        rows = body.get("UFs") or body.get("Ufs") or []
        if not isinstance(rows, list):
            raise UfProviderError("cmf: unexpected payload shape")

        points: UfSeries = []
        for row in rows:
            try:
                d = date.fromisoformat(str(row["Fecha"])[:10])
                value = parse_clp(str(row["Valor"]))
            except (KeyError, TypeError, ValueError):
                continue
            points.append((d, value))
        return validate_series(points, source=self.name)
