"""SII provider — scrapes https://www.sii.cl/valores_y_fechas/uf/uf<year>.htm.

The SII republishes the Banco Central's UF as one HTML page per year, one
`<table>` per month, newest month first. Each row holds three (day, value)
column pairs (days 1-10, 11-20, 21-31); unpublished days have an empty cell.

Chosen as the default primary source because the page carries the *forward*
block — on 2026-08-18 it already listed September 1-9 — which mindicador's
JSON does not expose. The parser is deliberately strict: anything unexpected
raises UfProviderError so the chain falls through to a JSON source rather than
persisting a misread table.
"""

from __future__ import annotations

import re
from calendar import monthrange
from datetime import date

import httpx

from app.features.uf.providers.base import (
    HTTP_TIMEOUT,
    UfProvider,
    UfProviderError,
    UfSeries,
    parse_clp,
    validate_series,
)

SII_BASE = "https://www.sii.cl/valores_y_fechas/uf"

MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

_TABLE_RE = re.compile(r"<table[^>]*>(.*?)</table>", re.S | re.I)
_MONTH_RE = re.compile(r"<h2[^>]*>\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*</h2>", re.I)
_PAIR_RE = re.compile(
    r"<th[^>]*>\s*(?:<strong>)?\s*(\d{1,2})\s*(?:</strong>)?\s*</th>\s*<td[^>]*>(.*?)</td>",
    re.S | re.I,
)
_TAGS_RE = re.compile(r"<[^>]+>")


class SiiProvider(UfProvider):
    name = "sii.cl"

    async def fetch_year(self, year: int) -> UfSeries:
        url = f"{SII_BASE}/uf{year}.htm"
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(url)
        except httpx.HTTPError as exc:
            raise UfProviderError(f"sii: request failed for {year}: {exc}") from exc

        if resp.status_code == 404:
            # Future years are simply not published yet — not an error.
            return []
        if resp.status_code >= 400:
            raise UfProviderError(f"sii: HTTP {resp.status_code} for {year}")

        # The page ships a UTF-8 BOM and no charset in Content-Type, so httpx's
        # own guess is unreliable. Decode explicitly.
        html = resp.content.decode("utf-8-sig", errors="replace")
        return validate_series(parse_year_page(html, year), source=self.name)


def parse_year_page(html: str, year: int) -> UfSeries:
    """Extract every published (date, value) from an SII year page."""
    points: UfSeries = []
    months_seen: set[int] = set()

    for table in _TABLE_RE.findall(html):
        month_match = _MONTH_RE.search(table)
        if not month_match:
            # The page also renders non-month tables (layout/legend). Skip.
            continue
        month = MONTHS.get(month_match.group(1).strip().lower())
        if month is None:
            raise UfProviderError(f"sii: unknown month heading {month_match.group(1)!r}")
        months_seen.add(month)
        last_day = monthrange(year, month)[1]

        for day_raw, value_raw in _PAIR_RE.findall(table):
            text = _TAGS_RE.sub("", value_raw).replace("&nbsp;", " ").strip()
            if not text:
                continue  # day not published yet
            day = int(day_raw)
            if not 1 <= day <= last_day:
                raise UfProviderError(f"sii: day {day} out of range for {year}-{month:02d}")
            try:
                value = parse_clp(text)
            except ValueError as exc:
                raise UfProviderError(f"sii: bad value {text!r} on {year}-{month:02d}-{day:02d}") from exc
            points.append((date(year, month, day), value))

    if not months_seen:
        raise UfProviderError(f"sii: no month tables found on the {year} page (layout changed?)")
    if not points:
        raise UfProviderError(f"sii: {len(months_seen)} month tables but no values parsed")
    return points
