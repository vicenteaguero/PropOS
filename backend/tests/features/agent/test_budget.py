"""Daily AI spend cap (settings.agent_daily_budget_usd).

Before this, the setting existed but nothing read it — there was no ceiling.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.agent import budget
from app.features.agent.budget import BudgetExceededError, check_daily_budget, record_spend_cents, spent_today_usd

TENANT = uuid4()


#: The cap these tests assert against. Pinned rather than inherited: the suite
#: was reading whatever `AGENT_DAILY_BUDGET_USD` happened to be in the
#: developer's `.env`, so raising the real budget turned five passing tests red
#: without a line of production code changing.
TEST_BUDGET_USD = 0.50


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(budget.settings, "agent_daily_budget_usd", TEST_BUDGET_USD)
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
    assert excinfo.value.budget_usd == pytest.approx(TEST_BUDGET_USD)
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


def test_stale_sentinel_survives_a_freshly_booted_process(db, monkeypatch):
    """The seeded baseline must be stale even when the monotonic clock is tiny.

    time.monotonic()'s epoch is arbitrary — on Linux it is the uptime — so for
    the first minute of a process (a cold Cloud Run container, a CI runner) a
    `refreshed_at=0.0` sentinel was NEWER than the TTL and read as fresh. The
    budget check then trusted one turn's cost instead of refetching, and this
    suite only caught it on a runner that happened to boot seconds earlier.
    """
    monkeypatch.setattr("app.features.agent.budget.time.monotonic", lambda: 5.0)
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
