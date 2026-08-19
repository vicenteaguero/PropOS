"""UF provider chain: SII parsing, sanity guards, fallback order."""

from datetime import date
from pathlib import Path

import httpx
import pytest
import respx

from app.core.config import settings as settings_module
from app.features.uf.providers import build_chain
from app.features.uf.providers.base import UfProviderError, validate_series
from app.features.uf.providers.cmf import CmfProvider
from app.features.uf.providers.mindicador import MindicadorProvider
from app.features.uf.providers.sii import SiiProvider, parse_year_page

FIXTURE = Path(__file__).parent / "fixtures" / "sii_uf2026.html"
SII_URL = "https://www.sii.cl/valores_y_fechas/uf/uf2026.htm"


@pytest.fixture
def sii_html() -> str:
    return FIXTURE.read_text(encoding="utf-8")


# --------------------------------------------------------------------- parsing


def test_sii_parses_month_tables(sii_html):
    points = dict(parse_year_page(sii_html, 2026))

    # Value verified against the live SII page and mindicador.cl on 2026-08-18.
    assert points[date(2026, 8, 18)] == 40856.64
    assert points[date(2026, 8, 1)] == 40844.79
    assert points[date(2026, 8, 31)] == 40873.77


def test_sii_exposes_forward_block(sii_html):
    """The reason SII leads the chain: values published past today."""
    points = dict(parse_year_page(sii_html, 2026))

    assert points[date(2026, 9, 1)] == 40875.09
    assert points[date(2026, 9, 9)] == 40885.63
    # September stops where publication stops — day 10 is not out yet.
    assert date(2026, 9, 10) not in points


def test_sii_skips_unpublished_days(sii_html):
    points = dict(parse_year_page(sii_html, 2026))
    september = [d for d in points if d.month == 9]

    assert len(september) == 9


def test_sii_rejects_page_without_month_tables():
    with pytest.raises(UfProviderError, match="no month tables"):
        parse_year_page("<html><body><p>mantenimiento</p></body></html>", 2026)


def test_sii_rejects_unknown_month_heading():
    html = "<table><tr><th><h2>Brumario</h2></th></tr><tr><th><strong>1</strong></th><td>40.000,00</td></tr></table>"
    with pytest.raises(UfProviderError, match="unknown month"):
        parse_year_page(html, 2026)


def test_sii_rejects_day_out_of_range():
    html = "<table><tr><th><h2>Febrero</h2></th></tr><tr><th><strong>30</strong></th><td>40.000,00</td></tr></table>"
    with pytest.raises(UfProviderError, match="out of range"):
        parse_year_page(html, 2026)


# ---------------------------------------------------------------- sanity guard


def test_validate_rejects_implausible_value():
    with pytest.raises(UfProviderError, match="implausible UF value"):
        validate_series([(date(2026, 8, 1), 18.0)], source="test")


def test_validate_rejects_implausible_drift():
    """A column read one month off would show up as a jump, not a drift."""
    series = [(date(2026, 8, 1), 40000.0), (date(2026, 8, 2), 41000.0)]
    with pytest.raises(UfProviderError, match="implausible drift"):
        validate_series(series, source="test")


def test_validate_accepts_real_series(sii_html):
    points = parse_year_page(sii_html, 2026)
    cleaned = validate_series(points, source="test")

    assert cleaned == sorted(cleaned)
    assert len(cleaned) == len(points)


def test_validate_allows_gaps_without_drift_false_positive():
    # 30-day gap, 0.4% total move — fine per day, would fail a naive check.
    series = [(date(2026, 1, 1), 40000.0), (date(2026, 1, 31), 40160.0)]

    assert len(validate_series(series, source="test")) == 2


# ----------------------------------------------------------------- http + chain


@pytest.mark.asyncio
@respx.mock
async def test_sii_provider_fetches_and_validates(sii_html):
    respx.get(SII_URL).mock(return_value=httpx.Response(200, content=sii_html.encode("utf-8")))

    series = await SiiProvider().fetch_year(2026)

    assert dict(series)[date(2026, 8, 18)] == 40856.64


@pytest.mark.asyncio
@respx.mock
async def test_sii_provider_treats_404_as_unpublished_year():
    respx.get("https://www.sii.cl/valores_y_fechas/uf/uf2099.htm").mock(return_value=httpx.Response(404))

    assert await SiiProvider().fetch_year(2099) == []


@pytest.mark.asyncio
@respx.mock
async def test_mindicador_provider_parses_serie():
    respx.get("https://mindicador.cl/api/uf").mock(
        return_value=httpx.Response(
            200,
            json={
                "serie": [
                    {"fecha": "2026-08-18T04:00:00.000Z", "valor": 40856.64},
                    {"fecha": "2026-08-17T04:00:00.000Z", "valor": 40855.33},
                ]
            },
        )
    )

    series = await MindicadorProvider().fetch_recent()

    assert series == [(date(2026, 8, 17), 40855.33), (date(2026, 8, 18), 40856.64)]


@pytest.mark.asyncio
async def test_cmf_provider_declines_without_api_key(monkeypatch):
    monkeypatch.setattr(settings_module.settings, "cmf_api_key", "", raising=False)

    with pytest.raises(UfProviderError, match="CMF_API_KEY not configured"):
        await CmfProvider().fetch_year(2026)


@pytest.mark.asyncio
@respx.mock
async def test_cmf_provider_parses_chilean_formatted_values(monkeypatch):
    monkeypatch.setattr(settings_module.settings, "cmf_api_key", "k", raising=False)
    respx.get("https://api.cmfchile.cl/api-sbifv3/recursos_api/uf/2026").mock(
        return_value=httpx.Response(
            200,
            json={"UFs": [{"Fecha": "2026-08-18", "Valor": "40.856,64"}]},
        )
    )

    assert await CmfProvider().fetch_year(2026) == [(date(2026, 8, 18), 40856.64)]


def test_chain_defaults_to_sii_then_mindicador(monkeypatch):
    monkeypatch.setattr(settings_module.settings, "uf_sources", "sii,mindicador", raising=False)

    assert [p.name for p in build_chain()] == ["sii.cl", "mindicador.cl"]


def test_chain_ignores_unknown_names_but_keeps_valid_ones(monkeypatch):
    monkeypatch.setattr(settings_module.settings, "uf_sources", "typo, mindicador", raising=False)

    assert [p.name for p in build_chain()] == ["mindicador.cl"]


def test_chain_falls_back_to_default_when_fully_misconfigured(monkeypatch):
    """A bad env var must not take the UF widget down."""
    monkeypatch.setattr(settings_module.settings, "uf_sources", "nonsense", raising=False)

    assert [p.name for p in build_chain()] == ["sii.cl", "mindicador.cl"]
