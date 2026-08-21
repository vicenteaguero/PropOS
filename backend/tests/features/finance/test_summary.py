"""Finance summary: per-currency aggregation + Santiago month bounds."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.finance.calc import month_bounds_scl, summarize_by_currency
from app.features.finance.service import FinanceService

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


class TestMonthBoundsScl:
    def test_bounds_carry_santiago_offset_not_utc(self):
        start, end = month_bounds_scl("2026-08")
        # Winter in Chile: UTC-4. Midnight local, never midnight UTC.
        assert start == "2026-08-01T00:00:00-04:00"
        assert end == "2026-09-01T00:00:00-04:00"

    def test_december_rolls_into_next_year(self):
        start, end = month_bounds_scl("2026-12")
        assert start.startswith("2026-12-01T00:00:00")
        assert end.startswith("2027-01-01T00:00:00")

    def test_summer_month_uses_dst_offset(self):
        # January is Chilean summer time: UTC-3.
        start, _ = month_bounds_scl("2026-01")
        assert start == "2026-01-01T00:00:00-03:00"

    def test_february_bound_is_march_first(self):
        _, end = month_bounds_scl("2026-02")
        assert end.startswith("2026-03-01T00:00:00")

    @pytest.mark.parametrize("month", ["", "2026", "2026-13", "2026-00", "26-08", "2026-8", None])
    def test_malformed_month_rejected(self, month):
        with pytest.raises(ValueError):
            month_bounds_scl(month)  # type: ignore[arg-type]


class TestSummarizeByCurrency:
    def test_currencies_never_mix(self):
        rows = [
            {"direction": "IN", "status": "COMPLETED", "amount_cents": 1_000_00, "currency": "CLP"},
            {"direction": "IN", "status": "COMPLETED", "amount_cents": 25_00, "currency": "UF"},
            {"direction": "OUT", "status": "COMPLETED", "amount_cents": 400_00, "currency": "CLP"},
        ]
        out = summarize_by_currency(rows)
        assert out["CLP"]["income_cents"] == 1_000_00
        assert out["CLP"]["expense_cents"] == 400_00
        assert out["CLP"]["net_cents"] == 600_00
        assert out["UF"]["income_cents"] == 25_00
        assert out["UF"]["net_cents"] == 25_00

    def test_pending_rows_land_in_receivable_and_payable(self):
        rows = [
            {"direction": "IN", "status": "PENDING", "amount_cents": 700_00, "currency": "CLP"},
            {"direction": "OUT", "status": "PENDING", "amount_cents": 300_00, "currency": "CLP"},
        ]
        out = summarize_by_currency(rows)
        assert out["CLP"]["receivable_cents"] == 700_00
        assert out["CLP"]["payable_cents"] == 300_00
        assert out["CLP"]["income_cents"] == 0

    def test_missing_currency_defaults_to_clp(self):
        out = summarize_by_currency([{"direction": "IN", "status": "COMPLETED", "amount_cents": 50}])
        assert out["CLP"]["income_cents"] == 50

    def test_cancelled_rows_ignored(self):
        out = summarize_by_currency(
            [{"direction": "IN", "status": "CANCELLED", "amount_cents": 999, "currency": "CLP"}]
        )
        assert out["CLP"] == {
            "income_cents": 0,
            "expense_cents": 0,
            "net_cents": 0,
            "receivable_cents": 0,
            "payable_cents": 0,
        }

    def test_no_rows_yields_no_buckets(self):
        assert summarize_by_currency([]) == {}


def _rpc_returning(rows: list[dict]) -> MagicMock:
    """Stub `client.rpc(name, params).execute()`.

    The rows it returns are already grouped by (direction, status, currency),
    which is what `finance_summary_totals` gives back — the summariser adds up
    six buckets now, not every transaction in the tenant.
    """
    rpc = MagicMock()
    rpc.return_value.execute.return_value = MagicMock(data=rows)
    return rpc


@pytest.mark.asyncio
@patch("app.features.finance.service.get_supabase_client")
async def test_summary_keeps_flat_keys_on_clp_and_exposes_other_currencies(mock_client):
    mock_client.return_value.rpc = _rpc_returning(
        [
            {"direction": "IN", "status": "COMPLETED", "amount_cents": 1_000_00, "currency": "CLP"},
            {"direction": "IN", "status": "COMPLETED", "amount_cents": 25_00, "currency": "UF"},
        ]
    )

    out = await FinanceService.summary(TENANT_ID)

    assert out["currency"] == "CLP"
    assert out["income_cents"] == 1_000_00  # UF row must not leak into the flat total
    assert out["by_currency"]["UF"]["income_cents"] == 25_00
    assert out["currencies"] == ["CLP", "UF"]


@pytest.mark.asyncio
@patch("app.features.finance.service.get_supabase_client")
async def test_summary_month_filter_uses_santiago_bounds(mock_client):
    rpc = _rpc_returning([])
    mock_client.return_value.rpc = rpc

    await FinanceService.summary(TENANT_ID, "2026-08")

    _, params = rpc.call_args[0]
    assert params["p_from"] == "2026-08-01T00:00:00-04:00"
    assert params["p_to"] == "2026-09-01T00:00:00-04:00"


@pytest.mark.asyncio
@patch("app.features.finance.service.get_supabase_client")
async def test_summary_without_rows_returns_zeroed_totals(mock_client):
    mock_client.return_value.rpc = _rpc_returning([])

    out = await FinanceService.summary(TENANT_ID)

    assert out["income_cents"] == 0
    assert out["net_cents"] == 0
    assert out["by_currency"] == {}


@pytest.mark.asyncio
@patch("app.features.finance.service.get_supabase_client")
async def test_summary_asks_the_database_to_aggregate(mock_client):
    """The paging loop this replaced is gone, and so is the reason for it.

    `_fetch_all` walked `transactions` a thousand rows at a time because an
    unbounded select is silently truncated at db-max-rows, which would have
    produced a plausible but incomplete total. Aggregating in SQL removes the
    failure mode rather than working around it: there is no page to truncate.
    """
    rpc = _rpc_returning([])
    mock_client.return_value.rpc = rpc

    await FinanceService.summary(TENANT_ID)

    rpc.assert_called_once_with(
        "finance_summary_totals",
        {"p_tenant_id": TENANT_ID, "p_from": None, "p_to": None},
    )
    mock_client.return_value.table.assert_not_called()
