"""Agent attribution on accepted proposals (P2-54).

Every write the agent makes lands in `audit_log` with `source='agent'` and a
non-null `agent_session_id`. That attribution is what the restore procedure in
`docs/disaster-recovery.md` replays, and the only thing carrying it is a pair
of PostgREST request headers set around the accept dispatcher. Nothing tested
them, so losing them (a client refactor, a postgrest-py bump) would make agent
writes indistinguishable from human ones — silently.

These tests assert the *behaviour*, not the code shape: while the mutation
runs, the request carries agent attribution; once it is done, it does not.
`tests/integration/test_audit_stamping.py` closes the other half of the loop
and proves those headers actually produce the audit row.

The client is faked by seeding the `get_supabase_client` lru_cache, so the
tests keep working wherever the header logic ends up living.
"""

from __future__ import annotations

from collections.abc import Generator
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.core.supabase import client as client_module
from app.core.supabase.client import get_supabase_client
from app.features.pending import service as pending_service
from app.features.pending.service import ACCEPT_DISPATCHERS, PendingService

TENANT_ID = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
REVIEWER_ID = UUID("11111111-1111-1111-1111-111111111111")

SESSION_HEADER = "X-Agent-Session-Id"
SOURCE_HEADER = "X-Action-Source"


# ── Supabase double ──────────────────────────────────────────────────


class _Result:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Builder:
    """Chainable stand-in for the PostgREST query builder.

    Records the update payload so the accept path's own bookkeeping can be
    asserted, and returns the canned row for reads.
    """

    def __init__(self, row: dict[str, Any], updates: list[dict[str, Any]]) -> None:
        self._row = row
        self._updates = updates
        self._payload: dict[str, Any] | None = None

    def select(self, *_a: Any, **_k: Any) -> _Builder:
        return self

    def update(self, payload: dict[str, Any]) -> _Builder:
        self._payload = payload
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Builder:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Builder:
        return self

    def single(self) -> _Builder:
        return self

    def execute(self) -> _Result:
        if self._payload is not None:
            self._updates.append(self._payload)
            return _Result([{**self._row, **self._payload}])
        return _Result(self._row)


class _Postgrest:
    def __init__(self) -> None:
        self.session = type("_Session", (), {"headers": {}})()


class FakeSupabase:
    def __init__(self, row: dict[str, Any]) -> None:
        self.row = row
        self.updates: list[dict[str, Any]] = []
        self.postgrest = _Postgrest()

    def table(self, _name: str) -> _Builder:
        return _Builder(self.row, self.updates)


def _proposal(session_id: UUID, kind: str) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "tenant_id": str(TENANT_ID),
        "agent_session_id": str(session_id),
        "kind": kind,
        "status": "pending",
        "payload": {"title": "Casa en Las Condes"},
        "resolved_payload": None,
    }


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> Generator[FakeSupabase, None, None]:
    """Seed the client lru_cache with a double.

    Patching `create_client` instead of the getter means every module that
    already imported `get_supabase_client` receives the double too — the test
    does not care which module ends up setting the headers.
    """
    fake = FakeSupabase(row={})
    monkeypatch.setattr(client_module, "create_client", lambda *_a, **_k: fake)
    get_supabase_client.cache_clear()
    yield fake
    get_supabase_client.cache_clear()


@pytest.fixture
def registered_kind() -> Generator[Any, None, None]:
    """Register a throwaway accept dispatcher and remove it afterwards."""
    kind = f"test_kind_{uuid4().hex[:8]}"
    yield kind
    ACCEPT_DISPATCHERS.pop(kind, None)


# ── Tests ────────────────────────────────────────────────────────────


async def test_mutation_runs_with_agent_attribution(
    fake_client: FakeSupabase,
    registered_kind: str,
) -> None:
    """While the dispatcher writes, the request must be attributable to the agent."""
    session_id = uuid4()
    fake_client.row = _proposal(session_id, registered_kind)
    seen: dict[str, str] = {}

    def dispatcher(**kwargs: Any) -> tuple[str, UUID]:
        seen.update(dict(fake_client.postgrest.session.headers))
        return "properties", uuid4()

    pending_service.register_accept_dispatcher(registered_kind, dispatcher)

    await PendingService.accept_proposal(
        proposal_id=UUID(fake_client.row["id"]),
        tenant_id=TENANT_ID,
        reviewer_user=REVIEWER_ID,
    )

    assert seen.get(SOURCE_HEADER) == "agent", f"write was not attributed to the agent: {seen}"
    assert seen.get(SESSION_HEADER) == str(session_id), f"write did not carry the originating session: {seen}"


async def test_attribution_does_not_leak_after_accept(
    fake_client: FakeSupabase,
    registered_kind: str,
) -> None:
    """A later human write on the same client must not be labelled 'agent'."""
    fake_client.row = _proposal(uuid4(), registered_kind)

    pending_service.register_accept_dispatcher(registered_kind, lambda **_k: ("properties", uuid4()))

    await PendingService.accept_proposal(
        proposal_id=UUID(fake_client.row["id"]),
        tenant_id=TENANT_ID,
        reviewer_user=REVIEWER_ID,
    )

    headers = fake_client.postgrest.session.headers
    assert SOURCE_HEADER not in headers, f"agent attribution leaked into later requests: {dict(headers)}"
    assert SESSION_HEADER not in headers, f"agent session id leaked into later requests: {dict(headers)}"


async def test_attribution_is_cleared_when_the_mutation_fails(
    fake_client: FakeSupabase,
    registered_kind: str,
) -> None:
    """A failed accept must not leave the client stamping every later write."""
    fake_client.row = _proposal(uuid4(), registered_kind)

    def exploding(**_kwargs: Any) -> tuple[str, UUID]:
        raise RuntimeError("executor blew up")

    pending_service.register_accept_dispatcher(registered_kind, exploding)

    with pytest.raises(RuntimeError):
        await PendingService.accept_proposal(
            proposal_id=UUID(fake_client.row["id"]),
            tenant_id=TENANT_ID,
            reviewer_user=REVIEWER_ID,
        )

    headers = fake_client.postgrest.session.headers
    assert SOURCE_HEADER not in headers, f"agent attribution survived a failed accept: {dict(headers)}"
    assert SESSION_HEADER not in headers, f"agent session id survived a failed accept: {dict(headers)}"


async def test_accepting_records_the_row_the_agent_created(
    fake_client: FakeSupabase,
    registered_kind: str,
) -> None:
    """The proposal must point at what it produced, or the audit trail dead-ends."""
    created_id = uuid4()
    fake_client.row = _proposal(uuid4(), registered_kind)

    pending_service.register_accept_dispatcher(registered_kind, lambda **_k: ("properties", created_id))

    await PendingService.accept_proposal(
        proposal_id=UUID(fake_client.row["id"]),
        tenant_id=TENANT_ID,
        reviewer_user=REVIEWER_ID,
    )

    assert fake_client.updates, "accept did not persist any status update"
    update = fake_client.updates[-1]
    assert update["status"] == "accepted"
    assert update["target_table"] == "properties"
    assert update["created_row_id"] == str(created_id)
    assert update["reviewer_user"] == str(REVIEWER_ID)


async def test_non_pending_proposal_is_refused(
    fake_client: FakeSupabase,
    registered_kind: str,
) -> None:
    """Double-accept must not re-run the mutation."""
    fake_client.row = _proposal(uuid4(), registered_kind) | {"status": "accepted"}
    calls: list[int] = []

    def dispatcher(**_kwargs: Any) -> tuple[str, UUID]:
        calls.append(1)
        return "properties", uuid4()

    pending_service.register_accept_dispatcher(registered_kind, dispatcher)

    with pytest.raises(ValueError):
        await PendingService.accept_proposal(
            proposal_id=UUID(fake_client.row["id"]),
            tenant_id=TENANT_ID,
            reviewer_user=REVIEWER_ID,
        )
    assert not calls, "an already-accepted proposal ran its mutation again"
