"""UF service: provider fallback, forward rows, source stamping."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.features.uf import service as uf_service
from app.features.uf.providers.base import UfProvider, UfProviderError

TODAY = date(2026, 8, 18)
FETCHED_TODAY = "2026-08-18T12:00:00+00:00"
FETCHED_YESTERDAY = "2026-08-17T12:00:00+00:00"
SERIES = [(date(2026, 8, 18), 40856.64), (date(2026, 9, 1), 40875.09)]


class _StubProvider(UfProvider):
    def __init__(self, name: str, series=None, error: str | None = None):
        self.name = name
        self._series = series or []
        self._error = error
        self.calls = 0

    async def fetch_year(self, year: int):
        self.calls += 1
        if self._error:
            raise UfProviderError(self._error)
        return self._series


def _table(existing: list[dict] | None = None) -> MagicMock:
    table = MagicMock()
    for method in ("select", "eq", "gte", "lte", "gt", "order", "limit", "upsert"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data=existing or [])
    return table


@pytest.fixture(autouse=True)
def _freeze_today(monkeypatch):
    monkeypatch.setattr(uf_service, "today_santiago", lambda: TODAY)


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_skips_network_when_row_was_fetched_today(mock_client, monkeypatch):
    mock_client.return_value.table.return_value = _table([{"value_clp": 40856.64, "fetched_at": FETCHED_TODAY}])
    provider = _StubProvider("sii.cl", SERIES)
    monkeypatch.setattr(uf_service, "build_chain", lambda: [provider])

    d, value, inserted = await uf_service.ensure_today()

    assert (d, value, inserted) == (TODAY, 40856.64, False)
    assert provider.calls == 0


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_refetches_stale_row_to_pull_forward_block(mock_client, monkeypatch):
    """Today's value alone is not enough — the forward block lands on the 9th."""
    table = _table([{"value_clp": 40856.64, "fetched_at": FETCHED_YESTERDAY}])
    mock_client.return_value.table.return_value = table
    provider = _StubProvider("sii.cl", SERIES)
    monkeypatch.setattr(uf_service, "build_chain", lambda: [provider])

    d, value, inserted = await uf_service.ensure_today()

    assert provider.calls == 1
    # Refreshing an existing row is not an insert.
    assert (d, value, inserted) == (TODAY, 40856.64, False)
    assert "2026-09-01" in {row["date"] for row in table.upsert.call_args[0][0]}


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_refetches_when_fetched_at_is_missing(mock_client, monkeypatch):
    mock_client.return_value.table.return_value = _table([{"value_clp": 40856.64}])
    provider = _StubProvider("sii.cl", SERIES)
    monkeypatch.setattr(uf_service, "build_chain", lambda: [provider])

    await uf_service.ensure_today()

    assert provider.calls == 1


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_falls_through_to_next_provider(mock_client, monkeypatch):
    table = _table([])
    mock_client.return_value.table.return_value = table
    broken = _StubProvider("sii.cl", error="layout changed")
    working = _StubProvider("mindicador.cl", SERIES)
    monkeypatch.setattr(uf_service, "build_chain", lambda: [broken, working])

    d, value, inserted = await uf_service.ensure_today()

    assert (d, value, inserted) == (TODAY, 40856.64, True)
    assert broken.calls == 1 and working.calls == 1


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_persists_the_answering_provider_as_source(mock_client, monkeypatch):
    table = _table([])
    mock_client.return_value.table.return_value = table
    monkeypatch.setattr(uf_service, "build_chain", lambda: [_StubProvider("sii.cl", SERIES)])

    await uf_service.ensure_today()

    payload = table.upsert.call_args[0][0]
    assert {row["source"] for row in payload} == {"sii.cl"}
    # The forward row is stored alongside today's — it is a published value.
    assert {row["date"] for row in payload} == {"2026-08-18", "2026-09-01"}


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_raises_when_every_provider_fails(mock_client, monkeypatch):
    mock_client.return_value.table.return_value = _table([])
    monkeypatch.setattr(
        uf_service,
        "build_chain",
        lambda: [_StubProvider("sii.cl", error="down"), _StubProvider("mindicador.cl", error="down")],
    )

    with pytest.raises(uf_service.UfFetchError):
        await uf_service.ensure_today()


@pytest.mark.asyncio
@patch("app.features.uf.service.get_supabase_client")
async def test_ensure_today_uses_latest_past_value_when_today_unpublished(mock_client, monkeypatch):
    mock_client.return_value.table.return_value = _table([])
    series = [(date(2026, 8, 15), 40852.69), (date(2026, 9, 1), 40875.09)]
    monkeypatch.setattr(uf_service, "build_chain", lambda: [_StubProvider("sii.cl", series)])

    d, value, inserted = await uf_service.ensure_today()

    # Never claims a forward value as "today".
    assert (d, value, inserted) == (date(2026, 8, 15), 40852.69, False)


@patch("app.features.uf.service.get_supabase_client")
def test_get_today_with_deltas_ignores_forward_rows(mock_client):
    table = _table(
        [
            {"date": "2026-08-18", "value_clp": 40856.64, "source": "sii.cl"},
            {"date": "2026-07-19", "value_clp": 40700.00, "source": "sii.cl"},
        ]
    )
    mock_client.return_value.table.return_value = table

    snapshot = uf_service.get_today_with_deltas()

    assert snapshot["today"] == {
        "date": date(2026, 8, 18),
        "value_clp": 40856.64,
        "source": "sii.cl",
    }
    assert snapshot["month_delta_pct"] == 0.38
    # The query must exclude anything after today.
    table.lte.assert_called_once_with("date", "2026-08-18")


@patch("app.features.uf.service.get_supabase_client")
def test_get_forward_returns_published_future_values(mock_client):
    table = _table([{"date": "2026-09-01", "value_clp": 40875.09, "source": "sii.cl"}])
    mock_client.return_value.table.return_value = table

    points = uf_service.get_forward()

    assert points == [{"date": date(2026, 9, 1), "value_clp": 40875.09, "source": "sii.cl"}]
    table.gt.assert_called_once_with("date", "2026-08-18")
    table.order.assert_called_once_with("date", desc=False)
