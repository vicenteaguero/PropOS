"""Which stage moves are legal, and which ones only a person may make.

`opportunities.pipeline_stage` is bare TEXT: before this, LEAD → CLOSED was a
legal move, and so was anything the assistant decided to do. The rule the
product actually wants is the one the vision states — scheduling a visit the
client just confirmed is automatic, declaring a deal lost never is.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.opportunities import transitions
from app.features.opportunities.transitions import TransitionDenied, allowed_targets, assert_allowed

TENANT = uuid4()
PIPELINE = str(uuid4())

DEAL = {"id": str(uuid4()), "pipeline_id": PIPELINE, "pipeline_stage": "VISIT"}

ROWS = [
    {"from_stage": "VISIT", "to_stage": "OFFER", "requires_human": False},
    {"from_stage": "VISIT", "to_stage": "QUALIFIED", "requires_human": False},
    {"from_stage": "OFFER", "to_stage": "CLOSED", "requires_human": True},
    # "from anywhere": abandoning is legal at any point.
    {"from_stage": None, "to_stage": "LOST", "requires_human": True},
]


@pytest.fixture(autouse=True)
def _stub_rows(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(transitions, "_transitions", lambda *_a, **_k: ROWS)


def test_a_declared_move_is_allowed() -> None:
    assert_allowed(TENANT, DEAL, "OFFER", by_agent=False)


def test_an_undeclared_move_is_refused() -> None:
    """LEAD straight to CLOSED was legal until this existed."""
    with pytest.raises(TransitionDenied) as exc:
        assert_allowed(TENANT, DEAL, "CLOSED", by_agent=False)
    assert "VISIT" in exc.value.detail and "CLOSED" in exc.value.detail


def test_the_agent_may_not_make_a_human_move() -> None:
    with pytest.raises(TransitionDenied):
        assert_allowed(TENANT, {**DEAL, "pipeline_stage": "OFFER"}, "CLOSED", by_agent=True)


def test_a_human_may_make_it() -> None:
    assert_allowed(TENANT, {**DEAL, "pipeline_stage": "OFFER"}, "CLOSED", by_agent=False)


def test_losing_a_deal_is_never_automatic() -> None:
    """The wildcard row applies from any stage, and always needs a person."""
    assert_allowed(TENANT, DEAL, "LOST", by_agent=False)
    with pytest.raises(TransitionDenied):
        assert_allowed(TENANT, DEAL, "LOST", by_agent=True)


def test_staying_put_is_not_a_transition() -> None:
    assert_allowed(TENANT, DEAL, "VISIT", by_agent=True)


def test_a_deal_with_no_pipeline_is_unconstrained() -> None:
    """Pipelines are optional; a tenant without one must not find its CRM frozen."""
    assert_allowed(TENANT, {"id": "x", "pipeline_id": None, "pipeline_stage": "LEAD"}, "CLOSED", by_agent=True)


def test_a_pipeline_with_no_declared_transitions_is_unconstrained(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(transitions, "_transitions", lambda *_a, **_k: [])
    assert_allowed(TENANT, DEAL, "CLOSED", by_agent=True)


def test_allowed_targets_offers_only_legal_moves() -> None:
    targets = {t["to_stage"]: t["requires_human"] for t in allowed_targets(TENANT, DEAL)}
    assert targets == {"OFFER": False, "QUALIFIED": False, "LOST": True}
    assert "CLOSED" not in targets
