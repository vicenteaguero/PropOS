"""Multi-step executors must be all-or-nothing.

PostgREST gives no transaction across calls: a failed participants insert used
to leave an orphan interaction behind, and the dispatcher then queued a
proposal for the *same* action — accepting it created a second interaction.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent.tools import executors

TENANT = uuid4()
USER = uuid4()
SESSION = uuid4()


class _Builder:
    def __init__(self, client: _Client, table: str) -> None:
        self._client = client
        self._table = table
        self._mode: str | None = None
        self._filters: dict[str, str] = {}

    def insert(self, rows: Any) -> _Builder:
        if self._table in self._client.fail_on:
            raise RuntimeError(f"insert into {self._table} rejected")
        payload = rows if isinstance(rows, list) else [rows]
        self._client.inserted.setdefault(self._table, []).extend(payload)
        self._mode = "insert"
        self._rows = [{"id": str(uuid4()), **row} for row in payload]
        return self

    def select(self, *_a: str) -> _Builder:
        self._mode = "select"
        return self

    def update(self, _payload: dict[str, Any]) -> _Builder:
        self._mode = "update"
        return self

    def delete(self) -> _Builder:
        self._mode = "delete"
        return self

    def eq(self, column: str, value: str) -> _Builder:
        self._filters[column] = value
        return self

    def in_(self, _column: str, _values: list[str]) -> _Builder:
        return self

    def execute(self) -> Any:
        if self._mode == "delete":
            self._client.deleted.append((self._table, self._filters.get("id")))
            return type("R", (), {"data": []})()
        if self._mode == "insert":
            return type("R", (), {"data": self._rows})()
        return type("R", (), {"data": self._client.select_rows.get(self._table, [])})()


class _Client:
    def __init__(self, fail_on: set[str] | None = None) -> None:
        self.fail_on = fail_on or set()
        self.inserted: dict[str, list[dict[str, Any]]] = {}
        self.deleted: list[tuple[str, str | None]] = []
        self.select_rows: dict[str, list[dict[str, Any]]] = {}

    def table(self, name: str) -> _Builder:
        return _Builder(self, name)


@pytest.fixture
def client_for(monkeypatch: pytest.MonkeyPatch):
    def _make(fail_on: set[str] | None = None) -> _Client:
        fake = _Client(fail_on)
        monkeypatch.setattr(executors, "get_supabase_client", lambda: fake)
        return fake

    return _make


def _interaction_payload() -> dict[str, Any]:
    return {
        "kind": "VISIT",
        "summary": "visita",
        "participant_person_ids": [str(uuid4())],
    }


def test_happy_path_leaves_nothing_to_undo(client_for):
    fake = client_for()
    executors._accept_log_interaction(_interaction_payload(), TENANT, USER, SESSION)
    assert fake.deleted == []
    assert len(fake.inserted["interactions"]) == 1
    assert len(fake.inserted["interaction_participants"]) == 1


def test_failed_participants_insert_removes_the_orphan_interaction(client_for):
    fake = client_for(fail_on={"interaction_participants"})
    with pytest.raises(RuntimeError):
        executors._accept_log_interaction(_interaction_payload(), TENANT, USER, SESSION)

    assert len(fake.deleted) == 1
    table, deleted_id = fake.deleted[0]
    assert table == "interactions"
    assert deleted_id is not None


def test_failed_target_insert_removes_the_orphan_interaction(client_for):
    fake = client_for(fail_on={"interaction_targets"})
    payload = _interaction_payload() | {"property_id": str(uuid4())}
    with pytest.raises(RuntimeError):
        executors._accept_log_interaction(payload, TENANT, USER, SESSION)
    assert [t for t, _ in fake.deleted] == ["interactions"]


def test_failed_reminder_removes_the_task(client_for):
    fake = client_for(fail_on={"reminders"})
    with pytest.raises(RuntimeError):
        executors._accept_create_task({"title": "llamar", "remind_at": "2026-09-01T10:00:00Z"}, TENANT, USER, SESSION)
    assert [t for t, _ in fake.deleted] == ["tasks"]


def test_failed_reminder_removes_the_event(client_for):
    fake = client_for(fail_on={"reminders"})
    with pytest.raises(RuntimeError):
        executors._accept_create_event(
            {"title": "visita", "starts_at": "2026-09-01T10:00:00Z", "remind_at": "2026-09-01T09:00:00Z"},
            TENANT,
            USER,
            SESSION,
        )
    assert [t for t, _ in fake.deleted] == ["events"]


def test_task_without_reminder_needs_no_guard(client_for):
    fake = client_for(fail_on={"reminders"})
    executors._accept_create_task({"title": "llamar"}, TENANT, USER, SESSION)
    assert fake.deleted == []


def test_failed_media_assets_insert_removes_the_document(client_for):
    fake = client_for(fail_on={"media_assets"})
    fake.select_rows["agent_messages"] = [{"id": "m1", "media_url": "https://cdn/a.jpg", "media_mime": "image/jpeg"}]
    with pytest.raises(RuntimeError):
        executors._accept_create_document_from_photos(
            {"title": "tasación", "media_message_ids": ["m1"]}, TENANT, USER, SESSION
        )
    assert [t for t, _ in fake.deleted] == ["documents"]


def test_failed_media_assets_insert_removes_the_media_files(client_for):
    fake = client_for(fail_on={"media_assets"})
    fake.select_rows["agent_messages"] = [{"id": "m1", "media_url": "https://cdn/a.jpg", "media_mime": "image/jpeg"}]
    with pytest.raises(RuntimeError):
        executors._accept_attach_photos_to_property(
            {"property_id": str(uuid4()), "media_message_ids": ["m1"]}, TENANT, USER, SESSION
        )
    assert [t for t, _ in fake.deleted] == ["media_files"]


def test_rollback_failure_never_masks_the_original_error():
    class _Broken:
        def table(self, _name: str):
            raise RuntimeError("postgrest down")

    with (
        pytest.raises(RuntimeError, match="original"),
        executors._rollback_on_failure(_Broken(), "interactions", ["a"]),
    ):
        raise RuntimeError("original failure")
