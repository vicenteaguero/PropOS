"""The autonomy contract: what Propo may do without a human.

Before this existed, `IntentSpec.auto_commit` defaulted to True and ten of the
twelve intents wrote straight into the CRM — including creating and editing
people, with no consent evidence and nobody reviewing. These tests pin the two
halves of the fix: the risk tier that decides the default, and the dispatcher
actually obeying it.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent import dispatcher, policies
from app.features.agent.intent_registry import REGISTRY
from app.features.agent.policies import AutonomyLevel, default_level
from app.features.agent.resolver import ResolvedFields

TENANT = uuid4()
USER = uuid4()
SESSION = uuid4()


@pytest.mark.parametrize("action", sorted(policies._EXECUTE_BY_DEFAULT))
def test_low_risk_actions_execute(action: str) -> None:
    assert default_level(action) is AutonomyLevel.EXECUTE


@pytest.mark.parametrize(
    "action",
    ["create_person", "update_person", "create_property", "log_transaction", "create_campaign"],
)
def test_everything_touching_a_person_or_money_suggests(action: str) -> None:
    assert default_level(action) is AutonomyLevel.SUGGEST


def test_an_unknown_action_suggests() -> None:
    """A new intent must default to asking.

    Inheriting `execute` by omission is exactly how ten intents ended up writing
    unattended in the first place.
    """
    assert default_level("some_intent_added_next_week") is AutonomyLevel.SUGGEST


def test_every_registered_intent_has_a_level() -> None:
    for name in REGISTRY:
        assert default_level(name) in (AutonomyLevel.EXECUTE, AutonomyLevel.SUGGEST)


def _dispatch(monkeypatch: pytest.MonkeyPatch, level: AutonomyLevel, seen: dict[str, Any]):
    monkeypatch.setattr(dispatcher, "level_for", lambda *_a, **_k: level)
    monkeypatch.setattr(dispatcher, "agent_attribution", lambda _sid: _NullScope())
    monkeypatch.setattr(
        dispatcher,
        "ACCEPTOR_BY_KIND",
        {"propose_create_person": lambda *_a, **_k: seen.setdefault("wrote", True) and ("contacts", uuid4())},
    )
    monkeypatch.setattr(
        dispatcher,
        "_create_proposal",
        lambda **kwargs: seen.update(queued=kwargs) or {"proposal_id": str(uuid4()), "kind": kwargs["kind"]},
    )
    return dispatcher.dispatch(
        "create_person",
        ResolvedFields(extras={"full_name": "Pedro Soto", "kind": "BUYER"}),
        tenant_id=TENANT,
        user_id=USER,
        session_id=SESSION,
        evidence={"quote": "anota a Pedro Soto", "source": "whatsapp"},
        message_id=str(uuid4()),
    )


class _NullScope:
    def __enter__(self):
        return None

    def __exit__(self, *_exc):
        return False


def test_suggest_queues_and_does_not_write(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}
    outcome = _dispatch(monkeypatch, AutonomyLevel.SUGGEST, seen)
    assert outcome["kind"] == "proposal"
    assert "wrote" not in seen
    # The evidence rides along: a proposal a reviewer cannot trace back to what
    # the client said is not reviewable.
    assert seen["queued"]["evidence"]["quote"] == "anota a Pedro Soto"
    assert seen["queued"]["message_id"]


def test_execute_writes_and_does_not_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}
    outcome = _dispatch(monkeypatch, AutonomyLevel.EXECUTE, seen)
    assert outcome["kind"] == "executed"
    assert seen["wrote"] is True
    assert "queued" not in seen


def test_observe_neither_writes_nor_queues(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}
    outcome = _dispatch(monkeypatch, AutonomyLevel.OBSERVE, seen)
    assert outcome["kind"] == "observed"
    assert seen == {}


def test_lookup_failure_falls_back_to_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """A briefly unreachable settings table must not kill the turn — and must
    not silently promote an action to `execute` either."""

    def boom():
        raise RuntimeError("postgrest down")

    monkeypatch.setattr(policies, "get_supabase_client", boom)
    assert policies.level_for(TENANT, "create_person") is AutonomyLevel.SUGGEST
    assert policies.level_for(TENANT, "add_note") is AutonomyLevel.EXECUTE
