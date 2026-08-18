"""Commission receivable spawned when an opportunity is marked WON."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.features.opportunities.service import OpportunityService

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
OPP_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"


def _client(existing: list[dict] | None = None) -> tuple[MagicMock, MagicMock]:
    """Supabase stub. Returns (client, transactions table mock)."""
    tx = MagicMock()
    for method in ("select", "eq", "contains", "limit", "insert"):
        getattr(tx, method).return_value = tx
    tx.execute.return_value = MagicMock(data=existing or [])
    client = MagicMock()
    client.table.return_value = tx
    return client, tx


def _inserted(tx: MagicMock) -> dict:
    return tx.insert.call_args[0][0]


def test_commission_carries_the_deal_currency():
    client, tx = _client()
    opp = {"id": OPP_ID, "expected_value_cents": 10_000_00, "commission_rate_pct": 2.0, "currency": "UF"}

    OpportunityService._spawn_commission_receivable(client, opp, TENANT_ID)

    assert _inserted(tx)["currency"] == "UF"


def test_commission_defaults_to_clp_when_deal_has_no_currency():
    client, tx = _client()
    opp = {"id": OPP_ID, "expected_value_cents": 10_000_00, "commission_rate_pct": 2.0}

    OpportunityService._spawn_commission_receivable(client, opp, TENANT_ID)

    assert _inserted(tx)["currency"] == "CLP"


def test_null_currency_falls_back_to_clp():
    client, tx = _client()
    opp = {"id": OPP_ID, "expected_value_cents": 10_000_00, "commission_rate_pct": 2.0, "currency": None}

    OpportunityService._spawn_commission_receivable(client, opp, TENANT_ID)

    assert _inserted(tx)["currency"] == "CLP"


def test_existing_commission_is_not_duplicated():
    client, tx = _client(existing=[{"id": "already-there"}])
    opp = {"id": OPP_ID, "expected_value_cents": 10_000_00, "commission_rate_pct": 2.0, "currency": "UF"}

    OpportunityService._spawn_commission_receivable(client, opp, TENANT_ID)

    tx.insert.assert_not_called()


def test_opportunity_without_value_spawns_nothing():
    client, tx = _client()

    OpportunityService._spawn_commission_receivable(client, {"id": OPP_ID}, TENANT_ID)

    tx.insert.assert_not_called()
