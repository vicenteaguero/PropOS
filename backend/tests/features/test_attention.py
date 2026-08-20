"""Ranking rules for the attention queue.

These are the two decisions that make the queue readable: how a delay is
worded, and what "next" means when the sources disagree about whether the
important timestamp is in the past or the future.
"""

from __future__ import annotations

import datetime as dt

import pytest

from app.features.attention.schemas import AttentionItem, AttentionKind, Urgency
from app.features.attention.service import _humanize, rank

NOW = dt.datetime(2026, 8, 20, 12, 0, tzinfo=dt.UTC)


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
