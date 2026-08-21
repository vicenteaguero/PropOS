"""The product's success criterion, as a test.

"Nadie tiene que acordarse de actualizarlo." Everything else in this codebase
is in service of that sentence, so it gets a test that walks the whole path
rather than trusting six unit tests to add up to it.

An unknown number writes in. Nobody invents a person for them. A human links
the thread. The next message becomes a proposal carrying the client's own
words. Accepting it moves the real record, by a route somebody declared legal.
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

import pytest

from app.features.agent.policies import AutonomyLevel, default_level
from app.features.channels import client_agent, extraction
from app.features.opportunities.transitions import TransitionDenied, assert_allowed

TENANT = str(uuid4())


class _FakeDB:
    """Just enough PostgREST to watch what the inbound path writes."""

    def __init__(self, rows: dict[str, list[dict]]) -> None:
        self.rows = rows
        self.inserts: list[tuple[str, dict]] = []

    def table(self, name: str):
        return _Query(self, name)


class _Query:
    def __init__(self, store: _FakeDB, table: str) -> None:
        self.store, self.table_name = store, table
        self.filters: list[tuple[str, Any]] = []
        self._op, self._payload = "select", None
        self.not_ = self

    def select(self, *_a, **_k):
        return self

    def insert(self, row):
        self._op, self._payload = "insert", row
        return self

    def update(self, row):
        self._op, self._payload = "update", row
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def is_(self, column, value):
        self.filters.append((column, None if value == "null" else value))
        return self

    def neq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def single(self):
        return self

    def execute(self):
        if self._op == "insert":
            row = {"id": str(uuid4()), **self._payload}
            self.store.inserts.append((self.table_name, self._payload))
            self.store.rows.setdefault(self.table_name, []).append(row)
            return type("R", (), {"data": [row]})()
        if self._op == "update":
            return type("R", (), {"data": [self._payload]})()
        rows = [r for r in self.store.rows.get(self.table_name, []) if all(r.get(c) == v for c, v in self.filters)]
        return type("R", (), {"data": rows})()


def test_an_unknown_number_does_not_become_a_person(monkeypatch: pytest.MonkeyPatch) -> None:
    """Step one, and the one that used to silently fail.

    Every unknown number minted a contact named after its own phone number,
    typed BUYER, with no consent evidence — junk that looked exactly like a
    real CRM row in every list that showed it.
    """
    db = _FakeDB({"contacts": [], "contact_phones": []})
    monkeypatch.setattr(client_agent, "get_supabase_client", lambda: db)

    assert client_agent._find_contact_by_phone(TENANT, "+56977777777") is None
    assert not [t for t, _ in db.inserts if t == "contacts"]


def test_the_thread_still_exists_and_is_unidentified(monkeypatch: pytest.MonkeyPatch) -> None:
    """Not having a person is a state the product now has a queue for, rather
    than a hole it papers over."""
    db = _FakeDB({"client_conversations": []})
    monkeypatch.setattr(client_agent, "get_supabase_client", lambda: db)

    conv = client_agent._ensure_conversation(TENANT, None, "+56977777777", "thread-1")
    assert conv["contact_id"] is None
    assert conv["external_phone_e164"] == "+56977777777"


def test_an_identified_thread_turns_a_message_into_a_reviewable_proposal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Steps three and four: the AI reads, and a human gets one tap with the
    quote in front of them."""
    contact_id = str(uuid4())
    conversation = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "contact_id": contact_id,
        "source": "whatsapp",
    }
    captured: dict[str, Any] = {}

    async def fake_classify(_text):
        return type("A", (), {"intent": "create_task", "fields": {"title": "Llamar a Ana"}})()

    monkeypatch.setattr(extraction, "classify", fake_classify)
    monkeypatch.setattr(extraction, "load_snapshot", lambda _t: object())
    monkeypatch.setattr(extraction, "resolve", lambda *_a, **_k: object())
    monkeypatch.setattr(
        extraction,
        "dispatch",
        lambda intent, _r, **kw: captured.update(kw) or {"kind": "proposal", "proposal_id": "p1"},
    )

    result = asyncio.run(
        extraction.extract_from_inbound(
            tenant_id=TENANT,
            conversation=conversation,
            message_id="wamid.2",
            text="Me interesa, ¿podemos ver el depto el jueves?",
            proposed_by_user=None,
        )
    )

    assert result["proposal_id"] == "p1"
    # A proposal a reviewer cannot trace back to what the client said is not
    # reviewable, and the reviewer is the last thing between the model and the
    # database.
    assert "el jueves" in captured["evidence"]["quote"]
    # And a stranger's sentence can never write, whatever the tenant allows.
    assert captured["force_level"] is AutonomyLevel.SUGGEST


def test_accepting_moves_the_record_only_by_a_declared_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Step five. `pipeline_stage` is bare TEXT, so before this every move was
    legal — including LEAD straight to CLOSED, by anyone or anything."""
    from app.features.opportunities import transitions

    monkeypatch.setattr(
        transitions,
        "_transitions",
        lambda *_a, **_k: [
            {"from_stage": "VISIT", "to_stage": "OFFER", "requires_human": False},
            {"from_stage": None, "to_stage": "LOST", "requires_human": True},
        ],
    )
    deal = {"id": str(uuid4()), "pipeline_id": str(uuid4()), "pipeline_stage": "VISIT"}

    assert_allowed(TENANT, deal, "OFFER", by_agent=True)

    with pytest.raises(TransitionDenied):
        assert_allowed(TENANT, deal, "CLOSED", by_agent=True)
    with pytest.raises(TransitionDenied):
        assert_allowed(TENANT, deal, "LOST", by_agent=True)


def test_the_autonomy_default_is_the_one_the_product_argues_for() -> None:
    """Scheduling a visit the client just confirmed is automatic; declaring a
    deal lost never is. Ten of twelve intents used to execute unattended."""
    assert default_level("create_event") is AutonomyLevel.EXECUTE
    assert default_level("add_note") is AutonomyLevel.EXECUTE
    assert default_level("create_person") is AutonomyLevel.SUGGEST
    assert default_level("log_transaction") is AutonomyLevel.SUGGEST
