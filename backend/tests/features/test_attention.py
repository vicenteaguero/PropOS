"""Ranking rules for the attention queue.

These are the two decisions that make the queue readable: how a delay is
worded, and what "next" means when the sources disagree about whether the
important timestamp is in the past or the future.
"""

from __future__ import annotations

import datetime as dt

import pytest

from uuid import UUID

from app.features.attention import service
from app.features.attention.schemas import AttentionItem, AttentionKind, Urgency
from app.features.attention.service import _humanize, rank

NOW = dt.datetime(2026, 8, 20, 12, 0, tzinfo=dt.UTC)
TENANT = UUID("dededede-0000-4000-8000-000000000001")


class _StubClient:
    """Just enough PostgREST to run one `select().eq()...execute()` chain."""

    def __init__(self, rows: list[dict]):
        self._rows = rows

    def table(self, _name: str) -> "_StubClient":
        return self

    def select(self, *_a, **_k) -> "_StubClient":
        return self

    def eq(self, *_a, **_k) -> "_StubClient":
        return self

    def neq(self, *_a, **_k) -> "_StubClient":
        return self

    def is_(self, *_a, **_k) -> "_StubClient":
        return self

    def limit(self, *_a, **_k) -> "_StubClient":
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def item(kind: AttentionKind, urgency: Urgency, deadline: dt.datetime | None) -> AttentionItem:
    return AttentionItem(
        id=f"{kind.value}:{deadline}",
        kind=kind,
        urgency=urgency,
        title="x",
        reason="x",
        deadline=deadline,
    )


@pytest.mark.parametrize(
    ("delta", "expected"),
    [
        (dt.timedelta(seconds=30), "hace 1 min"),
        (dt.timedelta(minutes=45), "hace 45 min"),
        (dt.timedelta(hours=3), "hace 3 h"),
        (dt.timedelta(days=1), "hace 1 día"),
        (dt.timedelta(days=6), "hace 6 días"),
        (dt.timedelta(days=70), "hace 2 meses"),
    ],
)
def test_humanize(delta: dt.timedelta, expected: str) -> None:
    assert _humanize(delta) == expected


def test_urgency_beats_deadline() -> None:
    """A `soon` item never outranks a `now` one, however close its deadline."""
    soon = item(AttentionKind.LEAD, Urgency.SOON, NOW + dt.timedelta(minutes=1))
    now = item(AttentionKind.VISIT, Urgency.NOW, NOW + dt.timedelta(days=1))
    items = [soon, now]
    rank(items, NOW)
    assert items == [now, soon]


def test_overdue_sorts_before_upcoming_within_a_bucket() -> None:
    """Already-blown first, most overdue leading — then the soonest deadline.

    This is the case that made the old `at`-based sort wrong in the opposite
    direction, and the one that decides whether a visit starting in an hour is
    visible above yesterday's backlog.
    """
    very_late = item(AttentionKind.TASK, Urgency.NOW, NOW - dt.timedelta(days=2))
    late = item(AttentionKind.TASK, Urgency.NOW, NOW - dt.timedelta(hours=2))
    soon = item(AttentionKind.VISIT, Urgency.NOW, NOW + dt.timedelta(hours=1))
    later = item(AttentionKind.VISIT, Urgency.NOW, NOW + dt.timedelta(hours=5))
    items = [later, soon, late, very_late]
    rank(items, NOW)
    assert items == [very_late, late, soon, later]


def test_missing_deadline_sinks_within_its_bucket() -> None:
    """A deal going quiet has no deadline; it must not lead the bucket."""
    quiet = item(AttentionKind.STALLED, Urgency.SOON, None)
    dated = item(AttentionKind.LEAD, Urgency.SOON, NOW + dt.timedelta(days=3))
    items = [quiet, dated]
    rank(items, NOW)
    assert items == [dated, quiet]


@pytest.mark.parametrize(
    ("hours", "urgency", "reason"),
    [
        (1, Urgency.SOON, "Sin responder"),
        (6, Urgency.TODAY, "Sin responder"),
        (21, Urgency.NOW, "Quedan 3 h de ventana"),
        (30, Urgency.TODAY, "Requiere plantilla"),
        (24 * 40, Urgency.SOON, "Sin responder"),
    ],
)
def test_unanswered_reason_never_restates_the_timestamp(
    hours: int, urgency: Urgency, reason: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The row prints `at` itself, so the reason must not say "hace 6 días" too.

    It did, and being the longer of the two it won the row: the property — the
    one string a broker recognises at a glance — was truncated to make space for
    an elapsed time already printed six characters to the right. A countdown
    ("Quedan 3 h de ventana") is different information and survives.
    """
    inbound = NOW - dt.timedelta(hours=hours)
    rows = [
        {
            "id": "11111111-1111-4111-8111-111111111111",
            "contact_id": None,
            "external_phone_e164": "+56900000000",
            "status": "open",
            "last_inbound_at": inbound.isoformat(),
            "last_message_at": inbound.isoformat(),
            "metadata": {},
        }
    ]
    monkeypatch.setattr(service, "_client", lambda: _StubClient(rows))

    produced = list(service._unanswered(TENANT, NOW, {}, {}))
    assert len(produced) == 1
    assert produced[0].urgency is urgency
    assert produced[0].reason == reason
    assert "hace" not in produced[0].reason
