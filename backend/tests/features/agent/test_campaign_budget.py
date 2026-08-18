"""`create_campaign` must not throw the budget away.

The executor filtered `budget` out of the payload without converting it, while
the column is `campaigns.budget_cents` (BIGINT) — so "crea una campaña de
Instagram con 200 lucas" recorded a campaign with no budget and the broker had
no way to tell.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent.tools import executors

TENANT = uuid4()
USER = uuid4()
SESSION = uuid4()


class _Table:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def insert(self, row: dict[str, Any]) -> _Table:
        self._rows.append(row)
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": [{"id": str(uuid4())}]})()


class _Client:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def table(self, _name: str) -> _Table:
        return _Table(self.rows)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> _Client:
    fake = _Client()
    monkeypatch.setattr(executors, "get_supabase_client", lambda: fake)
    return fake


def _create(client: _Client, payload: dict[str, Any]) -> dict[str, Any]:
    executors._accept_create_campaign(payload, TENANT, USER, SESSION)
    return client.rows[0]


def test_pesos_are_converted_to_cents(client):
    row = _create(client, {"name": "IG septiembre", "channel": "META", "budget": 200_000})
    assert row["budget_cents"] == 20_000_000
    assert "budget" not in row


def test_string_budget_from_the_model_is_coerced(client):
    row = _create(client, {"name": "c", "channel": "META", "budget": "200000"})
    assert row["budget_cents"] == 20_000_000


def test_missing_budget_stays_absent(client):
    row = _create(client, {"name": "c", "channel": "META"})
    assert "budget_cents" not in row


def test_unparseable_budget_does_not_break_the_insert(client):
    row = _create(client, {"name": "c", "channel": "META", "budget": "doscientas lucas"})
    assert "budget_cents" not in row
    assert row["name"] == "c"


def test_explicit_cents_win_over_pesos(client):
    row = _create(client, {"name": "c", "channel": "META", "budget": 1, "budget_cents": 500})
    assert row["budget_cents"] == 500


def test_agent_provenance_is_kept(client):
    row = _create(client, {"name": "c", "channel": "META", "budget": 1_000, "summary_es": "crear campaña"})
    assert row["source"] == "agent"
    assert row["tenant_id"] == str(TENANT)
    assert "summary_es" not in row
