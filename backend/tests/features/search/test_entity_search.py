"""Entity search — the one endpoint every "link this to a record" picker uses.

Before it existed, pickers reached the per-feature list endpoints, so only the
two that happened to accept a `q` (properties, contacts) were searchable. A note
can point at six kinds, which left four of them unreachable from the UI.
Opportunities were the hard case: the table has no title column, so its label
has to be resolved through the person and property it joins.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from app.features.search.schemas import EntityKind
from app.features.search.service import search_entities

TENANT = uuid4()


class _Builder:
    """Minimal stand-in for the PostgREST query builder, recording its filters."""

    def __init__(self, rows: list[dict], log: dict):
        self._rows = rows
        self._log = log

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def in_(self, _col, ids):
        self._rows = [r for r in self._rows if r["id"] in ids]
        return self

    def ilike(self, col, pattern):
        self._log.setdefault("ilike", []).append((col, pattern))
        needle = pattern.strip("%").lower()
        self._rows = [r for r in self._rows if needle in str(r.get(col, "")).lower()]
        return self

    def or_(self, clause):
        self._log.setdefault("or_", []).append(clause)
        return self

    def execute(self):
        return type("Res", (), {"data": self._rows})()


def _client(tables: dict[str, list[dict]], log: dict | None = None):
    log = log if log is not None else {}

    class _Client:
        def table(self, name):
            return _Builder(list(tables.get(name, [])), log)

    return _Client()


@pytest.fixture
def contacts_only():
    return {"contacts": [{"id": str(uuid4()), "full_name": "Rocío Vergara", "email": "r@x.cl"}]}


def test_every_kind_is_searchable(contacts_only):
    """The regression that mattered: four of six kinds had no endpoint at all."""
    tables = {
        "properties": [{"id": str(uuid4()), "title": "Casa", "address": "Av. Uno"}],
        "contacts": contacts_only["contacts"],
        "opportunities": [],
        "events": [{"id": str(uuid4()), "title": "Visita", "starts_at": "2026-08-20T10:00:00Z"}],
        "projects": [{"id": str(uuid4()), "name": "Condominio"}],
        "places": [{"id": str(uuid4()), "name": "Bodega"}],
    }
    with patch("app.features.search.service.get_supabase_client", return_value=_client(tables)):
        for kind in EntityKind:
            hits = search_entities(TENANT, kind)
            assert all(h.kind == kind for h in hits)


def test_contact_hit_carries_a_label_and_a_subtitle(contacts_only):
    with patch(
        "app.features.search.service.get_supabase_client",
        return_value=_client(contacts_only),
    ):
        hit = search_entities(TENANT, EntityKind.CONTACT)[0]
    assert hit.label == "Rocío Vergara"
    assert hit.sub == "r@x.cl"


def test_opportunity_label_is_resolved_through_person_and_property():
    """An opportunity has no text of its own — the label is a join, not a column."""
    person, prop, opp = str(uuid4()), str(uuid4()), str(uuid4())
    tables = {
        "opportunities": [{"id": opp, "person_id": person, "property_id": prop, "pipeline_stage": "VISIT"}],
        "contacts": [{"id": person, "full_name": "Ana Soto"}],
        "properties": [{"id": prop, "title": "Depto Ñuñoa"}],
    }
    with patch("app.features.search.service.get_supabase_client", return_value=_client(tables)):
        hits = search_entities(TENANT, EntityKind.OPPORTUNITY)
    assert hits[0].label == "Ana Soto · Depto Ñuñoa"
    assert hits[0].sub == "VISIT"


def test_opportunity_search_returns_nothing_when_neither_side_matches():
    """Short-circuit: no matching person or property means no deal can match."""
    tables = {
        "opportunities": [{"id": str(uuid4()), "person_id": str(uuid4()), "property_id": None}],
        "contacts": [{"id": str(uuid4()), "full_name": "Ana Soto"}],
        "properties": [{"id": str(uuid4()), "title": "Depto"}],
    }
    with patch("app.features.search.service.get_supabase_client", return_value=_client(tables)):
        assert search_entities(TENANT, EntityKind.OPPORTUNITY, q="zzz") == []


def test_missing_label_falls_back_instead_of_raising():
    """A row with a null title must not 500 the picker."""
    tables = {"properties": [{"id": str(uuid4()), "title": None, "address": None}]}
    with patch("app.features.search.service.get_supabase_client", return_value=_client(tables)):
        hit = search_entities(TENANT, EntityKind.PROPERTY)[0]
    assert hit.label == "Sin título"


def test_kind_enum_matches_the_note_targets_migration():
    """The enum mirrors `note_target_kind`; drift would break linking silently."""
    assert {k.value for k in EntityKind} == {
        "PROPERTY",
        "CONTACT",
        "OPPORTUNITY",
        "EVENT",
        "PROJECT",
        "PLACE",
    }
