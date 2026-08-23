"""The geocoder proxy: shape, caching, and what happens when it is down."""

from __future__ import annotations

import httpx
import pytest

from app.features.geo import service


@pytest.fixture(autouse=True)
def _clear_cache():
    service._cache.clear()
    yield
    service._cache.clear()


FEATURE = {
    "geometry": {"coordinates": [-70.6, -33.42]},
    "properties": {
        "street": "Avenida Los Leones",
        "housenumber": "1234",
        "city": "Providencia",
        "state": "Región Metropolitana",
    },
}


def _stub(monkeypatch, payload, *, calls: list | None = None):
    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params=None, headers=None):
            if calls is not None:
                calls.append((url, params, headers))
            return _Response()

    monkeypatch.setattr(service.httpx, "AsyncClient", lambda **kwargs: _Client())


@pytest.mark.asyncio
async def test_flattens_geojson_into_a_pickable_address(monkeypatch):
    _stub(monkeypatch, {"features": [FEATURE]})
    items = await service.autocomplete("los leones")
    assert items == [
        {
            "label": "Avenida Los Leones 1234, Providencia",
            "address": "Avenida Los Leones 1234, Providencia",
            "comuna": "Providencia",
            "region": "Región Metropolitana",
            "lon": -70.6,
            "lat": -33.42,
        }
    ]


@pytest.mark.asyncio
async def test_identifies_itself_and_biases_to_chile(monkeypatch):
    calls: list = []
    _stub(monkeypatch, {"features": []}, calls=calls)
    await service.autocomplete("apoquindo")
    _url, params, headers = calls[0]
    assert "PropOS" in headers["User-Agent"]
    assert params["lat"] == str(service.BIAS_LAT)
    assert params["lon"] == str(service.BIAS_LON)


@pytest.mark.asyncio
async def test_second_identical_query_does_not_hit_the_provider(monkeypatch):
    calls: list = []
    _stub(monkeypatch, {"features": [FEATURE]}, calls=calls)
    await service.autocomplete("los leones")
    await service.autocomplete("Los Leones ")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_a_dead_geocoder_is_an_empty_list_not_a_500(monkeypatch):
    # The field this feeds accepts free text, so failing softly leaves the
    # broker able to type the address themselves.
    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, *args, **kwargs):
            raise httpx.ConnectTimeout("down")

    monkeypatch.setattr(service.httpx, "AsyncClient", lambda **kwargs: _Client())
    assert await service.autocomplete("providencia") == []


@pytest.mark.asyncio
async def test_drops_features_with_nothing_to_show(monkeypatch):
    _stub(monkeypatch, {"features": [{"properties": {"state": "Maule"}}, FEATURE]})
    items = await service.autocomplete("x")
    assert len(items) == 1
