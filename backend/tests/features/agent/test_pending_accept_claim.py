"""Accepting a proposal must be a claim, not a check-then-write.

`accept_proposal` read the status and then ran the mutation, so a double click
(or a retry after a timeout, or two open tabs) produced two domain rows from
one proposal — and the orphan was invisible from the UI.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from app.features.pending import service as pending_service
from app.features.pending.service import ACCEPT_DISPATCHERS, PendingService

TENANT = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
REVIEWER = uuid4()


class _Builder:
    """Query builder that actually honours `.eq()` filters on the single row."""

    def __init__(self, row: dict[str, Any], log: list[dict[str, Any]]) -> None:
        self._row = row
        self._log = log
        self._filters: dict[str, str] = {}
        self._update: dict[str, Any] | None = None

    def select(self, *_a: Any, **_k: Any) -> _Builder:
        return self

    def single(self) -> _Builder:
        return self

    def update(self, payload: dict[str, Any]) -> _Builder:
        self._update = payload
        return self

    def eq(self, column: str, value: Any) -> _Builder:
        self._filters[column] = value
        return self

    def _matches(self) -> bool:
        return all(str(self._row.get(col)) == str(val) for col, val in self._filters.items())

    def execute(self) -> Any:
        if self._update is None:
            return type("R", (), {"data": dict(self._row)})()
        if not self._matches():
            return type("R", (), {"data": []})()
        self._row.update(self._update)
        self._log.append(dict(self._update))
        return type("R", (), {"data": [dict(self._row)]})()


class _Client:
    def __init__(self, row: dict[str, Any]) -> None:
        self.row = row
        self.updates: list[dict[str, Any]] = []
        self.postgrest = type("_PG", (), {"session": type("_S", (), {"headers": {}})()})()

    def table(self, _name: str) -> _Builder:
        return _Builder(self.row, self.updates)


def _proposal(session_id: UUID, kind: str) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "tenant_id": str(TENANT),
        "agent_session_id": str(session_id),
        "kind": kind,
        "status": "pending",
        "payload": {"title": "Casa en Las Condes"},
        "resolved_payload": None,
    }


@pytest.fixture
def kind():
    name = f"test_kind_{uuid4().hex[:8]}"
    yield name
    ACCEPT_DISPATCHERS.pop(name, None)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, kind: str) -> _Client:
    fake = _Client(_proposal(uuid4(), kind))
    monkeypatch.setattr(pending_service, "get_supabase_client", lambda: fake)
    # Attribution builds its own client; keep it pointed at the same double.
    monkeypatch.setattr("app.core.supabase.client.build_client", lambda *_a, **_k: fake)
    return fake


async def _accept(client: _Client) -> Any:
    return await PendingService.accept_proposal(
        proposal_id=UUID(client.row["id"]),
        tenant_id=TENANT,
        reviewer_user=REVIEWER,
    )


async def test_second_accept_does_not_run_the_mutation_again(client, kind):
    runs: list[int] = []
    pending_service.register_accept_dispatcher(kind, lambda **_k: (runs.append(1), ("properties", uuid4()))[1])

    await _accept(client)
    # Simulate the racing caller: it read the proposal before the first accept
    # landed, so its in-memory copy still says pending.
    client.row["status"] = "accepted"
    with pytest.raises(ValueError):
        await _accept(client)

    assert len(runs) == 1


async def test_claim_precedes_the_mutation(client, kind):
    seen: list[str] = []

    def dispatcher(**_k: Any) -> tuple[str, UUID]:
        seen.append(client.row["status"])
        return "properties", uuid4()

    pending_service.register_accept_dispatcher(kind, dispatcher)
    await _accept(client)

    assert seen == ["accepted"], "the row was still claimable while the mutation ran"


async def test_failed_mutation_releases_the_claim(client, kind):
    def exploding(**_k: Any) -> tuple[str, UUID]:
        raise RuntimeError("executor blew up")

    pending_service.register_accept_dispatcher(kind, exploding)
    with pytest.raises(RuntimeError):
        await _accept(client)

    assert client.row["status"] == "pending", "a failed accept must stay retryable"
    assert client.row["reviewed_at"] is None


async def test_successful_accept_records_the_created_row(client, kind):
    created = uuid4()
    pending_service.register_accept_dispatcher(kind, lambda **_k: ("properties", created))

    result = await _accept(client)

    assert result["status"] == "accepted"
    assert result["target_table"] == "properties"
    assert result["created_row_id"] == str(created)
