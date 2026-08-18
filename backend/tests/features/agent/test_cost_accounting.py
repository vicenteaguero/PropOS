"""Cost persistence for agent turns (pricing + chat._cost_cents_for_turn).

`agent_messages.cost_cents` is an INT while a turn costs ~0.07c, so the
interesting property is that the *session total* is right even though each row
rounds to 0 or 1.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent import chat, pricing

SESSION = uuid4()


class _FakeTable:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def select(self, _cols: str) -> _FakeTable:
        return self

    def eq(self, *_a: str) -> _FakeTable:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": list(self._rows)})()


class _FakeClient:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def table(self, _name: str) -> _FakeTable:
        return _FakeTable(self.rows)


def test_price_table_covers_the_configured_default():
    from app.core.config.settings import settings

    assert pricing.get_price(settings.agent_provider, settings.agent_model) is not None


def test_cost_usd_matches_the_published_rate():
    # 1M in + 1M out on llama-3.3-70b = 0.59 + 0.79 USD.
    usd = pricing.cost_usd("groq", "llama-3.3-70b-versatile", 1_000_000, 1_000_000)
    assert usd == pytest.approx(1.38)


def test_unpriced_model_returns_none_not_zero():
    assert pricing.cost_usd("groq", "some-unlisted-model", 1000, 1000) is None
    assert pricing.cost_cents_exact("groq", "some-unlisted-model", 1000, 1000) is None


def test_single_cheap_turn_rounds_to_zero_cents():
    client = _FakeClient([])
    assert chat._cost_cents_for_turn(client, SESSION, 1_200, 40) == 0


def test_session_total_converges_instead_of_staying_at_zero():
    """The bug being fixed: naive per-row rounding sums to $0 forever."""
    rows: list[dict[str, Any]] = []
    client = _FakeClient(rows)
    for _ in range(60):
        cents = chat._cost_cents_for_turn(client, SESSION, 1_200, 40)
        rows.append({"tokens_in": 1_200, "tokens_out": 40, "cost_cents": cents})

    recorded = sum(r["cost_cents"] for r in rows)
    exact = pricing.cost_cents_exact("groq", "llama-3.3-70b-versatile", 60 * 1_200, 60 * 40)
    assert recorded > 0
    assert abs(recorded - exact) <= 1


def test_expensive_turn_is_charged_immediately():
    client = _FakeClient([])
    # 1M input tokens = 59 cents.
    assert chat._cost_cents_for_turn(client, SESSION, 1_000_000, 0) == 59


def test_unpriced_model_writes_null(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat.settings, "agent_model", "some-unlisted-model")
    assert chat._cost_cents_for_turn(_FakeClient([]), SESSION, 5_000, 500) is None
