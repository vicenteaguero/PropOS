"""Daily AI spend cap (settings.agent_daily_budget_usd).

Before this, the setting existed but nothing read it — there was no ceiling.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.agent import budget
from app.features.agent.budget import BudgetExceededError, check_daily_budget, record_spend_cents, spent_today_usd

TENANT = uuid4()


@pytest.fixture(autouse=True)
def _clean():
    budget.reset_cache()
    yield
    budget.reset_cache()


@pytest.fixture
def db(monkeypatch: pytest.MonkeyPatch):
    """Stub the DB read. `db.cents` is today's spend; `db.calls` counts reads."""

    class _Stub:
        cents = 0.0
        calls = 0

        def fetch(self, _tenant_id):
            type(self).calls += 1
            return type(self).cents

    stub = _Stub()
    _Stub.cents = 0.0
    _Stub.calls = 0
    monkeypatch.setattr(budget, "_fetch_spend_cents", stub.fetch)
    return _Stub


def test_under_budget_passes(db):
    db.cents = 10.0  # $0.10 of $0.50
    check_daily_budget(TENANT)


def test_at_or_over_budget_raises(db):
    db.cents = 50.0  # exactly $0.50
    with pytest.raises(BudgetExceededError) as excinfo:
        check_daily_budget(TENANT)
    assert excinfo.value.budget_usd == pytest.approx(0.50)
    assert excinfo.value.spent_usd == pytest.approx(0.50)


def test_zero_budget_disables_the_check(db, monkeypatch: pytest.MonkeyPatch):
    db.cents = 10_000.0
    monkeypatch.setattr(budget.settings, "agent_daily_budget_usd", 0.0)
    check_daily_budget(TENANT)


def test_reads_are_cached_within_the_ttl(db):
    db.cents = 5.0
    spent_today_usd(TENANT)
    spent_today_usd(TENANT)
    assert db.calls == 1


def test_local_spend_accumulates_between_refreshes(db):
    db.cents = 40.0
    spent_today_usd(TENANT)  # seeds the cache at $0.40
    record_spend_cents(TENANT, 12.0)
    with pytest.raises(BudgetExceededError):
        check_daily_budget(TENANT)


def test_recording_without_a_baseline_forces_a_refetch(db):
    db.cents = 60.0
    record_spend_cents(TENANT, 1.0)
    with pytest.raises(BudgetExceededError):
        check_daily_budget(TENANT)
    assert db.calls == 1


def test_cache_is_per_tenant(db):
    db.cents = 60.0
    other = uuid4()
    with pytest.raises(BudgetExceededError):
        check_daily_budget(TENANT)
    db.cents = 1.0
    check_daily_budget(other)
