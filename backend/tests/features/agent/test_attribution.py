"""Audit attribution around agent writes.

Two regressions guarded here:

* the auto-commit path (10 of 12 intents) skipped the headers the `audit_log`
  trigger reads, so those rows landed unattributed (P2-05);
* the stamping mutated the headers of the process-wide `@lru_cache`d client, so
  concurrent writers could steal each other's session id (P2-57).
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

import pytest

from app.core.supabase import client as client_module
from app.core.supabase.client import get_supabase_client
from app.features.agent import dispatcher
from app.features.agent.attribution import ACTION_SOURCE_HEADER, AGENT_SESSION_HEADER, agent_attribution
from app.features.agent.resolver import ResolvedFields

SESSION = uuid4()
TENANT = uuid4()
USER = uuid4()


class _FakeClient:
    """Stand-in that records the headers it was constructed with."""

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        session = type("_Session", (), {})()
        session.headers = dict(headers or {})
        self.postgrest = type("_PG", (), {})()
        self.postgrest.session = session


@pytest.fixture
def built_clients(monkeypatch: pytest.MonkeyPatch) -> list[_FakeClient]:
    """Every `create_client` call returns its own fake, honouring options.headers."""
    made: list[_FakeClient] = []

    def fake_create(_url: str, _key: str, options: Any = None) -> _FakeClient:
        client = _FakeClient(getattr(options, "headers", None))
        made.append(client)
        return client

    monkeypatch.setattr(client_module, "create_client", fake_create)
    get_supabase_client.cache_clear()
    yield made
    get_supabase_client.cache_clear()


def test_scoped_client_carries_the_headers(built_clients):
    with agent_attribution(SESSION):
        headers = get_supabase_client().postgrest.session.headers
        assert headers[AGENT_SESSION_HEADER] == str(SESSION)
        assert headers[ACTION_SOURCE_HEADER] == "agent"


def test_shared_client_is_never_stamped(built_clients):
    shared = get_supabase_client()
    with agent_attribution(SESSION):
        assert get_supabase_client() is not shared
    assert AGENT_SESSION_HEADER not in shared.postgrest.session.headers
    assert ACTION_SOURCE_HEADER not in shared.postgrest.session.headers


def test_scope_is_released_after_the_block(built_clients):
    shared = get_supabase_client()
    with agent_attribution(SESSION):
        pass
    assert get_supabase_client() is shared


def test_scope_is_released_when_the_body_raises(built_clients):
    shared = get_supabase_client()
    with pytest.raises(ValueError), agent_attribution(SESSION):
        raise ValueError("boom")
    assert get_supabase_client() is shared


def test_no_session_is_a_no_op(built_clients):
    shared = get_supabase_client()
    with agent_attribution(None):
        assert get_supabase_client() is shared


async def test_concurrent_scopes_do_not_steal_each_others_session(built_clients):
    """The P2-57 regression: two interleaved writers, two distinct sessions."""
    seen: dict[str, str] = {}

    async def write(session_id, delay: float) -> None:
        with agent_attribution(session_id):
            await asyncio.sleep(delay)
            seen[str(session_id)] = get_supabase_client().postgrest.session.headers[AGENT_SESSION_HEADER]

    first, second = uuid4(), uuid4()
    await asyncio.gather(write(first, 0.02), write(second, 0.0))

    assert seen[str(first)] == str(first)
    assert seen[str(second)] == str(second)


def test_direct_write_happens_inside_the_attribution_scope(monkeypatch: pytest.MonkeyPatch):
    """The P2-05 regression.

    The subject is the attribution scope, not the policy, so the level is
    stubbed: `create_person` used to execute directly because `auto_commit`
    defaulted to True, and under the risk-tiered defaults it now proposes —
    which is the point of that change, not a regression in this one.
    """
    seen: dict[str, Any] = {}
    active = [False]

    def fake_acceptor(payload, tenant_id, user_id, session_id):
        seen["attribution_active"] = active[0]
        return ("contacts", uuid4())

    class _Recorder:
        def __enter__(self):
            active[0] = True

        def __exit__(self, *_exc):
            active[0] = False
            return False

    monkeypatch.setattr(dispatcher, "agent_attribution", lambda _sid: _Recorder())
    monkeypatch.setattr(dispatcher, "level_for", lambda *_a, **_k: dispatcher.AutonomyLevel.EXECUTE)
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
    assert active[0] is False
