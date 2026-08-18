"""Resolver widening past the 30-row snapshot.

The snapshot only carries the 30 most recent rows per entity, so once a tenant
grew past that the resolver went blind: "llamé a Pedro Soto" stopped resolving
and the dispatcher duplicated the contact.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

import pytest

from app.features.agent import context
from app.features.agent.context import TenantSnapshot, _search_terms, search_entities
from app.features.agent.resolver import resolve

TENANT = uuid4()
OLD_CONTACT = str(uuid4())
RECENT_CONTACT = str(uuid4())


def _snapshot(**kwargs: Any) -> TenantSnapshot:
    return TenantSnapshot(tenant_id=TENANT, **kwargs)


def test_snapshot_hit_never_queries_the_db():
    calls: list[tuple[Any, ...]] = []

    def lookup(tenant_id, entity, query):
        calls.append((tenant_id, entity, query))
        return []

    snapshot = _snapshot(people=[{"id": RECENT_CONTACT, "full_name": "Pedro Soto"}])
    resolved = resolve({"person": "Pedro Soto"}, snapshot, lookup=lookup)

    assert resolved.person.resolved_id == UUID(RECENT_CONTACT)
    assert calls == []


def test_contact_outside_the_snapshot_is_found_server_side():
    def lookup(tenant_id, entity, query):
        assert tenant_id == TENANT
        assert entity == "people"
        return [{"id": OLD_CONTACT, "full_name": "Pedro Soto"}]

    snapshot = _snapshot(people=[{"id": RECENT_CONTACT, "full_name": "Ana Carreño"}])
    resolved = resolve({"person": "Pedro Soto"}, snapshot, lookup=lookup)

    assert resolved.person.status == "ok"
    assert resolved.person.resolved_id == UUID(OLD_CONTACT)


def test_empty_snapshot_still_resolves_via_lookup():
    resolved = resolve(
        {"property": "Av. Providencia 1711"},
        _snapshot(),
        lookup=lambda *_a: [{"id": OLD_CONTACT, "title": "Depto Av. Providencia 1711"}],
    )
    assert resolved.property.resolved_id == UUID(OLD_CONTACT)


def test_lookup_miss_keeps_not_found():
    resolved = resolve({"person": "Nadie Existente"}, _snapshot(), lookup=lambda *_a: [])
    assert resolved.person.status == "not_found"
    assert resolved.person.resolved_id is None


def test_ambiguity_among_looked_up_candidates_is_reported():
    a, b = str(uuid4()), str(uuid4())
    resolved = resolve(
        {"person": "Juan Pérez"},
        _snapshot(people=[{"id": RECENT_CONTACT, "full_name": "Ana Carreño"}]),
        lookup=lambda *_a: [
            {"id": a, "full_name": "Juan Pérez Soto"},
            {"id": b, "full_name": "Juan Pérez Rojas"},
        ],
    )
    assert resolved.is_ambiguous
    assert {c["id"] for c in resolved.ambiguity_summary[0]["candidates"]} == {a, b}


def test_widened_set_keeps_the_snapshot_rows():
    """A lookup that returns the same row twice must not duplicate candidates."""
    resolved = resolve(
        {"person": "Pedro Soto"},
        _snapshot(people=[{"id": OLD_CONTACT, "full_name": "Pedro Sotomayor"}]),
        lookup=lambda *_a: [{"id": OLD_CONTACT, "full_name": "Pedro Sotomayor"}],
    )
    assert [str(c.id) for c in resolved.person.candidates] == [OLD_CONTACT]


def test_create_person_does_not_look_up_an_existing_row():
    calls: list[Any] = []
    resolve(
        {"person": "Pedro Soto"},
        _snapshot(),
        intent="create_person",
        lookup=lambda *a: calls.append(a) or [],
    )
    assert calls == []


def test_search_terms_widen_from_phrase_to_words():
    assert _search_terms("Pedro Soto")[0] == "Pedro Soto"
    assert "Pedro" in _search_terms("Pedro Soto")
    assert _search_terms("  ") == []
    # Single-word queries do not repeat themselves.
    assert _search_terms("Soto") == ["Soto"]


class _Builder:
    def __init__(self, log: list[dict[str, Any]], rows: list[dict[str, Any]]) -> None:
        self._log = log
        self._rows = rows
        self._call: dict[str, Any] = {}

    def select(self, cols: str) -> _Builder:
        self._call["columns"] = cols
        return self

    def eq(self, col: str, value: str) -> _Builder:
        self._call[col] = value
        return self

    def is_(self, col: str, value: str) -> _Builder:
        self._call[col] = value
        return self

    def ilike(self, col: str, pattern: str) -> _Builder:
        self._call["ilike"] = (col, pattern)
        return self

    def limit(self, n: int) -> _Builder:
        self._call["limit"] = n
        return self

    def execute(self) -> Any:
        self._log.append(dict(self._call))
        return type("R", (), {"data": list(self._rows)})()


class _Client:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.calls: list[dict[str, Any]] = []
        self.tables: list[str] = []
        self._rows = rows

    def table(self, name: str) -> _Builder:
        self.tables.append(name)
        return _Builder(self.calls, self._rows)


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch):
    def _make(rows: list[dict[str, Any]]) -> _Client:
        client = _Client(rows)
        monkeypatch.setattr(context, "get_supabase_client", lambda: client)
        return client

    return _make


def test_search_is_scoped_to_the_tenant_and_skips_soft_deleted(fake_db):
    client = fake_db([{"id": OLD_CONTACT, "full_name": "Pedro Soto"}])
    rows = search_entities(TENANT, "people", "Pedro Soto")

    assert rows and rows[0]["id"] == OLD_CONTACT
    assert client.tables == ["contacts"]
    call = client.calls[0]
    assert call["tenant_id"] == str(TENANT)
    assert call["deleted_at"] == "null"
    assert call["ilike"] == ("full_name", "%Pedro Soto%")


def test_properties_search_covers_title_and_address(fake_db):
    client = fake_db([{"id": OLD_CONTACT, "title": "Depto", "address": "Apoquindo 1234"}])
    search_entities(TENANT, "properties", "Apoquindo")
    assert [c["ilike"][0] for c in client.calls] == ["title", "address"]


def test_unknown_entity_and_blank_query_are_no_ops(fake_db):
    client = fake_db([])
    assert search_entities(TENANT, "spaceships", "x") == []
    assert search_entities(TENANT, "people", "   ") == []
    assert client.calls == []


def test_db_failure_is_swallowed(monkeypatch: pytest.MonkeyPatch):
    class _Boom:
        def table(self, _name: str):
            raise RuntimeError("postgrest down")

    monkeypatch.setattr(context, "get_supabase_client", lambda: _Boom())
    assert search_entities(TENANT, "people", "Pedro") == []
