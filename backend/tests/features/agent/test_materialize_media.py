"""Lifting session media into `media_files`.

`media_files.type` and `.source` are CHECK-constrained, so writing the raw mime
type ('image/jpeg') and 'whatsapp' rejected every insert.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.features.agent.tools import executors

TENANT = uuid4()
USER = uuid4()

ALLOWED_TYPES = {"photo", "audio"}
ALLOWED_SOURCES = {"camera", "gallery", "recorder"}


class _Table:
    def __init__(self, store: dict[str, Any], name: str) -> None:
        self._store = store
        self._name = name
        self._mode: str | None = None
        self._payload: Any = None

    def select(self, *_a: str) -> _Table:
        self._mode = "select"
        return self

    def insert(self, row: dict[str, Any]) -> _Table:
        self._store.setdefault("inserts", []).append((self._name, row))
        self._payload = row
        self._mode = "insert"
        return self

    def update(self, payload: dict[str, Any]) -> _Table:
        self._store.setdefault("updates", []).append((self._name, payload))
        self._mode = "update"
        return self

    def in_(self, _col: str, values: list[str]) -> _Table:
        self._store.setdefault("in_values", []).append(values)
        return self

    def execute(self) -> Any:
        if self._mode == "insert":
            return type("R", (), {"data": [{"id": str(uuid4())}]})()
        return type("R", (), {"data": self._store["messages"]})()


class _Client:
    def __init__(self, messages: list[dict[str, Any]]) -> None:
        self.store: dict[str, Any] = {"messages": messages}

    def table(self, name: str) -> _Table:
        return _Table(self.store, name)


@pytest.fixture
def client_for(monkeypatch: pytest.MonkeyPatch):
    def _make(messages: list[dict[str, Any]]) -> _Client:
        fake = _Client(messages)
        monkeypatch.setattr(executors, "get_supabase_client", lambda: fake)
        return fake

    return _make


def test_photo_and_audio_rows_satisfy_the_check_constraints(client_for):
    fake = client_for(
        [
            {"id": "m1", "media_url": "https://cdn/a.jpg", "media_mime": "image/jpeg"},
            {"id": "m2", "media_url": "https://cdn/b.ogg", "media_mime": "audio/ogg"},
        ]
    )
    ids = executors._materialize_media(["m1", "m2"], tenant_id=TENANT, user_id=USER)

    assert len(ids) == 2
    rows = [row for table, row in fake.store["inserts"] if table == "media_files"]
    assert {r["type"] for r in rows} <= ALLOWED_TYPES
    assert {r["source"] for r in rows} <= ALLOWED_SOURCES
    assert [r["kind"] for r in rows] == ["PHOTO", "AUDIO"]


def test_unsupported_mime_is_skipped_not_written(client_for):
    fake = client_for([{"id": "m1", "media_url": "https://cdn/a.pdf", "media_mime": "application/pdf"}])
    assert executors._materialize_media(["m1"], tenant_id=TENANT, user_id=USER) == []
    assert "inserts" not in fake.store


def test_only_materialized_messages_are_marked_consumed(client_for):
    fake = client_for(
        [
            {"id": "m1", "media_url": "https://cdn/a.jpg", "media_mime": "image/jpeg"},
            {"id": "m2", "media_url": "https://cdn/b.pdf", "media_mime": "application/pdf"},
        ]
    )
    executors._materialize_media(["m1", "m2"], tenant_id=TENANT, user_id=USER)
    assert fake.store["in_values"][-1] == ["m1"]


def test_no_ids_short_circuits(client_for):
    assert executors._materialize_media([], tenant_id=TENANT, user_id=USER) == []
