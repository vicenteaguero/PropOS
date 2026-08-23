"""`tasks.related` label resolution, including the deal key it never had."""

from __future__ import annotations

from app.features.tasks import service


class _Result:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, store, name):
        self.store, self.name, self._ids = store, name, []
        self._fields = ""

    def select(self, fields):
        self._fields = fields
        return self

    def in_(self, _col, ids):
        self._ids = ids
        return self

    def execute(self):
        return _Result([r for r in self.store.get(self.name, []) if r["id"] in self._ids])


class _Client:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return _Table(self.store, name)


STORE = {
    "contacts": [
        {"id": "c1", "full_name": "Ana María Pérez Soto"},
        {"id": "c2", "full_name": "Juan Rojas"},
    ],
    "properties": [{"id": "p1", "title": "Departamento 3D/3B en venta en Macul"}],
    "opportunities": [
        {"id": "o1", "person_id": "c2", "property_id": "p1", "pipeline_stage": "NEGOTIATION"},
        {"id": "o2", "person_id": None, "property_id": None, "pipeline_stage": "NEW"},
    ],
}


def test_resolves_deals_by_the_two_ids_they_carry(monkeypatch):
    monkeypatch.setattr(service, "get_supabase_client", lambda: _Client(STORE))
    rows = [{"id": "t1", "related": {"opportunities": ["o1"]}}]
    service._hydrate_related_labels("t", rows)
    assert rows[0]["related_labels"]["opportunities"] == [
        {"id": "o1", "label": "Juan Rojas · Departamento 3D/3B en venta en Macul"}
    ]


def test_a_deal_with_nothing_attached_still_gets_a_label(monkeypatch):
    # A blank chip is worse than a generic one: it reads as a rendering fault.
    monkeypatch.setattr(service, "get_supabase_client", lambda: _Client(STORE))
    rows = [{"id": "t1", "related": {"opportunities": ["o2"]}}]
    service._hydrate_related_labels("t", rows)
    assert rows[0]["related_labels"]["opportunities"][0]["label"] == "Negocio"


def test_still_resolves_properties_and_people(monkeypatch):
    monkeypatch.setattr(service, "get_supabase_client", lambda: _Client(STORE))
    rows = [{"id": "t1", "related": {"properties": ["p1"], "people": ["c1"]}}]
    service._hydrate_related_labels("t", rows)
    labels = rows[0]["related_labels"]
    assert labels["properties"][0]["label"] == "Departamento 3D/3B en venta en Macul"
    assert labels["people"][0]["label"] == "Ana María Pérez Soto"
    assert labels["opportunities"] == []


def test_a_task_with_no_links_short_circuits(monkeypatch):
    def _boom():
        raise AssertionError("must not hit the database for a task with no links")

    monkeypatch.setattr(service, "get_supabase_client", _boom)
    rows = [{"id": "t1", "related": {}}]
    service._hydrate_related_labels("t", rows)
    assert rows[0]["related_labels"] == {"properties": [], "people": [], "opportunities": []}
