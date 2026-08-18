"""Audit attribution around agent writes.

The auto-commit path (10 of 12 intents) used to skip the headers the
`audit_log` trigger reads, so those rows landed unattributed.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent import dispatcher
from app.features.agent.attribution import ACTION_SOURCE_HEADER, AGENT_SESSION_HEADER, agent_attribution
from app.features.agent.resolver import ResolvedFields

SESSION = uuid4()
TENANT = uuid4()
USER = uuid4()


class _FakeClient:
    def __init__(self) -> None:
        self.postgrest = type("PG", (), {"session": type("S", (), {"headers": {}})()})()


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> _FakeClient:
    client = _FakeClient()
    monkeypatch.setattr("app.core.supabase.client.get_supabase_client", lambda: client)
    return client


def test_headers_are_set_inside_and_cleared_after(fake_client):
    headers = fake_client.postgrest.session.headers
    with agent_attribution(SESSION):
        assert headers[AGENT_SESSION_HEADER] == str(SESSION)
        assert headers[ACTION_SOURCE_HEADER] == "agent"
    assert AGENT_SESSION_HEADER not in headers
    assert ACTION_SOURCE_HEADER not in headers


def test_headers_are_cleared_when_the_body_raises(fake_client):
    headers = fake_client.postgrest.session.headers
    with pytest.raises(ValueError), agent_attribution(SESSION):
        raise ValueError("boom")
    assert AGENT_SESSION_HEADER not in headers


def test_no_session_is_a_no_op(fake_client):
    with agent_attribution(None):
        assert fake_client.postgrest.session.headers == {}


def test_auto_commit_writes_inside_the_attribution_scope(monkeypatch: pytest.MonkeyPatch):
    """The regression guard for P2-05."""
    seen: dict[str, Any] = {}

    def fake_acceptor(payload, tenant_id, user_id, session_id):
        seen.update(attribution_active=_active[0])
        return ("contacts", uuid4())

    _active = [False]

    class _Recorder:
        def __enter__(self):
            _active[0] = True

        def __exit__(self, *_exc):
            _active[0] = False
            return False

    monkeypatch.setattr(dispatcher, "agent_attribution", lambda _sid: _Recorder())
    monkeypatch.setattr(dispatcher, "ACCEPTOR_BY_KIND", {"propose_create_person": fake_acceptor})

    resolved = ResolvedFields(extras={"full_name": "Pedro Soto", "kind": "BUYER"})
    outcome = dispatcher.dispatch(
        "create_person",
        resolved,
        tenant_id=TENANT,
        user_id=USER,
        session_id=SESSION,
    )

    assert outcome["kind"] == "executed"
    assert seen["attribution_active"] is True
    assert _active[0] is False
