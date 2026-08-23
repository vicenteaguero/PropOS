"""Address autocomplete, proxied.

Why a proxy and not a direct call from the browser: a geocoder wants a real
`User-Agent` identifying the application (a browser will not let us set one),
the results are worth caching across every user in every tenant, and the
provider is a detail we want to be able to swap without shipping a frontend.

Why Photon and not Nominatim: Nominatim's usage policy forbids autocomplete in
so many words ("you may not use it for auto-complete search"). Photon (Komoot)
is built for type-ahead, is free, and needs no key. If this ever needs to be
self-hosted, only `PHOTON_URL` moves.
"""

from __future__ import annotations

import asyncio
from time import monotonic

import httpx

from app.core.logging.logger import get_logger

logger = get_logger(__name__)

PHOTON_URL = "https://photon.komoot.io/api"
ATTRIBUTION = "© OpenStreetMap contributors"
HTTP_TIMEOUT = 4.0
# Biased to Santiago: every tenant is Chilean, and without a bias "Los Leones"
# returns a street in Spain before the one in Providencia.
BIAS_LAT, BIAS_LON = -33.45, -70.66

_CACHE_TTL_S = 600.0
_CACHE_MAX = 512
_cache: dict[str, tuple[float, list[dict]]] = {}
_lock = asyncio.Lock()


def _pick(props: dict) -> str | None:
    for key in ("city", "town", "village", "district", "county"):
        value = props.get(key)
        if value:
            return value
    return None


def _to_suggestion(feature: dict) -> dict | None:
    props = feature.get("properties") or {}
    name = props.get("name")
    street = props.get("street")
    number = props.get("housenumber")
    comuna = _pick(props)

    # A street with a number reads as an address; a named place reads as itself.
    if street:
        head = f"{street} {number}".strip() if number else street
    else:
        head = name
    if not head:
        return None

    label = ", ".join(part for part in (head, comuna) if part)
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    return {
        "label": label,
        "address": label,
        "comuna": comuna,
        "region": props.get("state"),
        "lon": coords[0] if len(coords) == 2 else None,
        "lat": coords[1] if len(coords) == 2 else None,
    }


async def autocomplete(query: str, limit: int = 6) -> list[dict]:
    """Address suggestions for a partial string. Never raises — an empty list
    is a correct answer for "the geocoder is down", because the field it feeds
    accepts free text anyway."""
    key = f"{query.strip().lower()}|{limit}"
    now = monotonic()

    async with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < _CACHE_TTL_S:
            return hit[1]

    params = {
        "q": query,
        "limit": str(limit),
        "lang": "es",
        "lat": str(BIAS_LAT),
        "lon": str(BIAS_LON),
    }
    headers = {"User-Agent": "PropOS/0.1 (https://propos.cl; contacto@propos.cl)"}
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(PHOTON_URL, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("geocoder_unavailable", error=str(exc))
        return []

    items: list[dict] = []
    seen: set[str] = set()
    for feature in payload.get("features") or []:
        suggestion = _to_suggestion(feature)
        if not suggestion or suggestion["label"] in seen:
            continue
        seen.add(suggestion["label"])
        items.append(suggestion)

    async with _lock:
        if len(_cache) >= _CACHE_MAX:
            _cache.clear()
        _cache[key] = (now, items)
    return items
