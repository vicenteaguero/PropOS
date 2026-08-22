"""Usage ingest and the cost estimate behind the Uso dashboard."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.features.usage import service
from app.features.usage.schemas import UsageBatch, UsageEventIn, UsageKind

TENANT = uuid4()
USER = uuid4()


class _Table:
    def __init__(self, sink: list[list[dict]]):
        self.sink = sink

    def insert(self, rows):
        self.sink.append(rows)
        return self

    def execute(self):
        return type("Resp", (), {"data": []})()


@pytest.fixture
def inserted(monkeypatch: pytest.MonkeyPatch) -> list[list[dict]]:
    sink: list[list[dict]] = []
    monkeypatch.setattr(
        service,
        "get_supabase_client",
        lambda: type("C", (), {"table": staticmethod(lambda _n: _Table(sink))})(),
    )
    return sink


def _event(**kw):
    base = {
        "kind": UsageKind.PAGE_VIEW,
        "key": "/admin/clientes",
        "meta": {},
        "occurred_at": datetime(2026, 8, 22, 12, 0, tzinfo=UTC),
    }
    return UsageEventIn(**{**base, **kw})


def test_identity_comes_from_the_caller_not_the_body(inserted):
    """A client that could name its own user_id makes the table worthless."""
    service.record_events(TENANT, USER, [_event()])
    (row,) = inserted[0]
    assert row["tenant_id"] == str(TENANT)
    assert row["user_id"] == str(USER)


def test_the_client_timestamp_is_preserved(inserted):
    """Events are buffered, so stamping on arrival would compress a quiet hour."""
    when = datetime(2026, 8, 22, 9, 15, tzinfo=UTC)
    service.record_events(TENANT, USER, [_event(occurred_at=when)])
    assert inserted[0][0]["occurred_at"] == when.isoformat()


def test_a_batch_is_one_insert(inserted):
    service.record_events(TENANT, USER, [_event(), _event(key="/admin/agenda")])
    assert len(inserted) == 1
    assert len(inserted[0]) == 2


def test_the_batch_size_is_capped():
    with pytest.raises(ValueError):
        UsageBatch(events=[_event() for _ in range(101)])


def test_an_empty_batch_is_rejected():
    with pytest.raises(ValueError):
        UsageBatch(events=[])


def test_a_key_long_enough_to_be_a_url_is_rejected():
    with pytest.raises(ValueError):
        _event(key="/admin/" + "x" * 200)


def test_cost_matches_the_published_min_instance_skus():
    """2 vCPU + 1 GiB at $0.0000025 per unit-second, 16h/day, 30 days.

    CPU  2 x 30 x 16 x 3600 x 0.0000025 = 8.64
    Mem  1 x 30 x 16 x 3600 x 0.0000025 = 4.32
    """
    cost = service.cost_estimate(30)
    assert cost["cpu_usd"] == pytest.approx(8.64)
    assert cost["memory_usd"] == pytest.approx(4.32)
    assert cost["total_usd"] == pytest.approx(12.96)


def test_a_24h_floor_costs_the_documented_amount():
    cost = service.cost_estimate(30, floor_hours_per_day=24)
    assert cost["total_usd"] == pytest.approx(19.44)


def test_the_monthly_projection_ignores_the_window_length():
    """The projection is a rate, so asking for 7 days must not shrink it."""
    week = service.cost_estimate(7)
    month = service.cost_estimate(30)
    assert week["projected_monthly_usd"] == month["projected_monthly_usd"]
    assert week["total_usd"] < month["total_usd"]
