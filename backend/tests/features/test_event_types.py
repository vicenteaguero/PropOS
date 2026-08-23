"""The per-tenant event catalog."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.features.events import types_service
from app.features.events.schemas import EventCreate, EventTypeCreate, EventTypeUpdate


def test_kind_accepts_a_type_the_server_has_never_heard_of():
    # The whole point of the catalog: a tenant adds TASACION without a deploy.
    assert EventCreate(title="Tasación", starts_at="2026-09-01T10:00:00Z", kind="TASACION").kind == "TASACION"


@pytest.mark.parametrize("bad", ["tasacion", "Tasación", "TWO WORDS", "", "A" * 40])
def test_kind_still_has_to_look_like_a_key(bad):
    with pytest.raises(ValidationError):
        EventCreate(title="x", starts_at="2026-09-01T10:00:00Z", kind=bad)


def test_priority_is_bounded():
    assert EventCreate(title="x", starts_at="2026-09-01T10:00:00Z").priority == 0
    with pytest.raises(ValidationError):
        EventCreate(title="x", starts_at="2026-09-01T10:00:00Z", priority=3)


def test_update_cannot_rename_a_key():
    # `events.kind` carries the key with no FK, so renaming it would orphan
    # every event already filed under it.
    assert "key" not in EventTypeUpdate.model_fields


class _FakeTable:
    def __init__(self, store, name):
        self.store, self.name, self.filters = store, name, {}
        self._payload = None
        self._op = None
        self._count = None

    def select(self, *_a, **kw):
        self._op, self._count = "select", kw.get("count")
        return self

    def insert(self, values):
        self._op, self._payload = "insert", values
        return self

    def update(self, values):
        self._op, self._payload = "update", values
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def is_(self, *_a):
        return self

    def limit(self, *_a):
        return self

    def order(self, *_a, **_kw):
        return self

    def execute(self):
        rows = [r for r in self.store[self.name] if all(str(r.get(k)) == str(v) for k, v in self.filters.items())]
        if self._op == "insert":
            row = {"id": str(uuid4()), "is_system": False, **self._payload}
            self.store[self.name].append(row)
            rows = [row]
        elif self._op == "update":
            for row in rows:
                row.update(self._payload)
        elif self._op == "delete":
            for row in rows:
                self.store[self.name].remove(row)
        return type("R", (), {"data": rows, "count": len(rows)})()


@pytest.fixture
def store(monkeypatch):
    data: dict[str, list[dict]] = {"event_types": [], "events": []}
    monkeypatch.setattr(types_service, "_client", lambda: type("C", (), {"table": lambda _s, n: _FakeTable(data, n)})())
    return data


def test_deleting_a_type_with_events_deactivates_it_instead(store):
    tenant = uuid4()
    created = types_service.create_type(tenant, EventTypeCreate(key="TASACION", label="Tasación", behavior="visit"))
    store["events"].append({"tenant_id": str(tenant), "kind": "TASACION", "deleted_at": None})

    types_service.delete_type(tenant, created["id"])

    # Still there, just hidden: a hard delete would leave every tasación in the
    # calendar rendering as an unknown key.
    assert store["event_types"][0]["active"] is False


def test_deleting_an_unused_type_removes_it(store):
    tenant = uuid4()
    created = types_service.create_type(tenant, EventTypeCreate(key="TASACION", label="Tasación"))
    types_service.delete_type(tenant, created["id"])
    assert store["event_types"] == []


def test_system_types_cannot_be_deleted(store):
    tenant = uuid4()
    store["event_types"].append({"id": str(uuid4()), "tenant_id": str(tenant), "key": "VISIT", "is_system": True})
    with pytest.raises(HTTPException) as exc:
        types_service.delete_type(tenant, store["event_types"][0]["id"])
    assert exc.value.status_code == 409
