"""USD/CLP fetch: parsing, sanity band, caching, and error surface.

This module exists so the browser stops calling mindicador.cl directly, so the
tests care about the things a server-side fetch has to get right that a
client-side one never did: it must not hand out an implausible number, and it
must collapse concurrent callers into one upstream request.
"""

from datetime import date

import httpx
import pytest
import respx

from app.features.uf import usd as usd_module
from app.features.uf.usd import UsdFetchError, get_usd_today

URL = "https://mindicador.cl/api/dolar"


def _body(value: float = 955.4, fecha: str = "2026-08-18T04:00:00.000Z") -> dict:
    return {"codigo": "dolar", "serie": [{"fecha": fecha, "valor": value}]}


@pytest.fixture(autouse=True)
def _clear_cache():
    """Each test starts cold; the module-level cache would otherwise leak across."""
    usd_module._cache = None
    yield
    usd_module._cache = None


@respx.mock
@pytest.mark.asyncio
async def test_parses_date_and_value():
    respx.get(URL).mock(return_value=httpx.Response(200, json=_body()))
    d, value = await get_usd_today()
    assert d == date(2026, 8, 18)
    assert value == pytest.approx(955.4)


@respx.mock
@pytest.mark.asyncio
async def test_second_call_is_served_from_cache():
    route = respx.get(URL).mock(return_value=httpx.Response(200, json=_body()))
    await get_usd_today()
    await get_usd_today()
    assert route.call_count == 1, "the TTL cache should collapse the second call"


@respx.mock
@pytest.mark.asyncio
async def test_force_bypasses_the_cache():
    route = respx.get(URL).mock(return_value=httpx.Response(200, json=_body()))
    await get_usd_today()
    await get_usd_today(force=True)
    assert route.call_count == 2


@respx.mock
@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [0.0, 50.0, 99.9, 10_001.0, 1_000_000.0])
async def test_rejects_values_outside_the_sanity_band(bad: float):
    # A parser that picked up a date, an index or a percentage would land here.
    respx.get(URL).mock(return_value=httpx.Response(200, json=_body(value=bad)))
    with pytest.raises(UsdFetchError, match="implausible"):
        await get_usd_today()


@respx.mock
@pytest.mark.asyncio
async def test_empty_series_is_an_error_not_a_zero():
    respx.get(URL).mock(return_value=httpx.Response(200, json={"serie": []}))
    with pytest.raises(UsdFetchError, match="empty"):
        await get_usd_today()


@respx.mock
@pytest.mark.asyncio
async def test_malformed_entry_is_an_error():
    respx.get(URL).mock(return_value=httpx.Response(200, json={"serie": [{"valor": "abc"}]}))
    with pytest.raises(UsdFetchError):
        await get_usd_today()


@respx.mock
@pytest.mark.asyncio
async def test_non_json_response_is_an_error():
    respx.get(URL).mock(return_value=httpx.Response(200, text="<html>maintenance</html>"))
    with pytest.raises(UsdFetchError, match="not JSON"):
        await get_usd_today()


@respx.mock
@pytest.mark.asyncio
async def test_upstream_failure_is_wrapped():
    respx.get(URL).mock(return_value=httpx.Response(503))
    with pytest.raises(UsdFetchError, match="request failed"):
        await get_usd_today()


@respx.mock
@pytest.mark.asyncio
async def test_a_failed_fetch_does_not_poison_the_cache():
    respx.get(URL).mock(return_value=httpx.Response(503))
    with pytest.raises(UsdFetchError):
        await get_usd_today()
    assert usd_module._cache is None

    respx.get(URL).mock(return_value=httpx.Response(200, json=_body()))
    _, value = await get_usd_today()
    assert value == pytest.approx(955.4)
