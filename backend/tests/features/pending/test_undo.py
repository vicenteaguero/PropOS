"""Undoing an accepted proposal, and the guard that makes it survivable.

The owner chose a real undo over a link to the created record, knowing it
deletes live data. What separates "undo a proposal" from "lose the broker's
work" is one check: if anyone has touched that record since the agent wrote it,
undo refuses.
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.features.pending import undo as undo_mod
from app.features.pending.undo import UndoError, undo_accepted

TENANT = UUID("dededede-0000-4000-8000-000000000001")
ROW = str(uuid4())
ACCEPTED_AT = "2026-08-21T10:00:00+00:00"


class _Builder:
    def __init__(self, table: str, log: list, audit_rows: list[dict]):
        self._table = table
        self._log = log
        self._audit = audit_rows
        self._op = None
        self._values = None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def gt(self, _col, value):
        # The "has anyone edited it since" probe.
        self._audit = [r for r in self._audit if r["changed_at"] > value]
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def update(self, values):
        self._op, self._values = "update", values
        return self

    def delete(self):
        self._op = "delete"
        return self

    def execute(self):
        if self._op:
            self._log.append((self._table, self._op, self._values))
            return type("Res", (), {"data": [{"id": ROW}]})()
        return type("Res", (), {"data": self._audit if self._table == "audit_log" else []})()


def client(audit_rows: list[dict], log: list):
    class _C:
        def table(self, name):
            return _Builder(name, log, list(audit_rows))

    return _C()


def proposal(kind: str, table: str = "tasks") -> dict:
    return {
        "kind": kind,
        "target_table": table,
        "created_row_id": ROW,
        "reviewed_at": ACCEPTED_AT,
    }


def test_a_created_row_is_soft_deleted(monkeypatch: pytest.MonkeyPatch) -> None:
    log: list = []
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client([], log))

    undo_accepted(proposal("propose_create_task"), TENANT)

    table, op, values = log[-1]
    assert table == "tasks"
    assert op == "update"
    assert "deleted_at" in values  # soft, so nothing is truly lost


def test_a_later_human_edit_blocks_the_undo(monkeypatch: pytest.MonkeyPatch) -> None:
    """The guard. Without it, undo overwrites work the broker did afterwards."""
    log: list = []
    later = [{"id": str(uuid4()), "changed_at": "2026-08-21T18:00:00+00:00"}]
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client(later, log))

    with pytest.raises(UndoError) as exc:
        undo_accepted(proposal("propose_create_task"), TENANT)

    assert "editaste" in str(exc.value)
    assert log == []  # and nothing was written


def test_an_edit_before_the_accept_does_not_block_it(monkeypatch: pytest.MonkeyPatch) -> None:
    log: list = []
    earlier = [{"id": str(uuid4()), "changed_at": "2026-08-20T09:00:00+00:00"}]
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client(earlier, log))

    undo_accepted(proposal("propose_create_task"), TENANT)
    assert log


def test_an_update_restores_instead_of_deleting(monkeypatch: pytest.MonkeyPatch) -> None:
    """`propose_update_person` edited a contact that already existed. Deleting
    it would destroy a real person; the audit log's `before` is the undo."""
    log: list = []
    audit = [
        {
            "id": str(uuid4()),
            "changed_at": ACCEPTED_AT,
            "before": {"id": ROW, "tenant_id": str(TENANT), "full_name": "Bárbara", "notes": None},
        }
    ]

    class _C:
        def table(self, name):
            # The freshness probe must find nothing; the before-image lookup must.
            return _Builder(name, log, audit if name == "audit_log" else [])

    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: _C())
    monkeypatch.setattr(undo_mod, "_newer_human_edit", lambda *_a, **_k: False)

    undo_accepted(proposal("propose_update_person", "contacts"), TENANT)

    table, op, values = log[-1]
    assert (table, op) == ("contacts", "update")
    assert values["full_name"] == "Bárbara"
    # Identity columns are never written back: restoring them can move the row.
    assert "id" not in values and "tenant_id" not in values


def test_photos_refuse_because_the_id_is_the_property(monkeypatch: pytest.MonkeyPatch) -> None:
    """`_accept_attach_photos_to_property` returns the PROPERTY id under the
    table name `media_assets`, so there is nothing here identifying what to
    remove — and a naive delete would take the property with it."""
    log: list = []
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client([], log))

    with pytest.raises(UndoError):
        undo_accepted(proposal("propose_attach_photos_to_property", "media_assets"), TENANT)
    assert log == []


def test_a_table_not_on_the_list_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    """Silence is refusal: a table nobody thought about cannot be deleted from."""
    log: list = []
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client([], log))
    monkeypatch.setattr(undo_mod, "_newer_human_edit", lambda *_a, **_k: False)

    with pytest.raises(UndoError):
        undo_accepted(proposal("propose_something", "audit_log"), TENANT)
    assert log == []


def test_a_proposal_that_created_nothing_cannot_be_undone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    log: list = []
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client([], log))
    with pytest.raises(UndoError):
        undo_accepted({"kind": "propose_create_task", "target_table": None}, TENANT)


def test_a_missing_accept_timestamp_is_treated_as_unsafe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Undo has to PROVE the record is untouched. No timestamp, no proof."""
    log: list = []
    monkeypatch.setattr(undo_mod, "get_supabase_client", lambda: client([], log))
    p = proposal("propose_create_task")
    p["reviewed_at"] = None
    with pytest.raises(UndoError):
        undo_accepted(p, TENANT)
    assert log == []
