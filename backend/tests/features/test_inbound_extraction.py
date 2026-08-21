"""Reading a client's message into the CRM, without letting it write.

This is the product's thesis: the broker converses and the record follows.
Until now the B2C assistant read the message, answered it and threw the content
away — its prompt asks the model to capture budget and comuna, and nothing
parsed the reply.

The safety rule is the interesting half. A message from outside the company is
not an instruction: anyone who knows the number can send one, so an intent
found in a stranger's words becomes a proposal a human sees, never a row.
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

import pytest

from app.features.agent.policies import AutonomyLevel
from app.features.channels import extraction

TENANT = str(uuid4())
CONTACT = str(uuid4())
CONVERSATION = {
    "id": str(uuid4()),
    "tenant_id": TENANT,
    "contact_id": CONTACT,
    "source": "whatsapp",
}


class _Action:
    def __init__(self, intent: str, fields: dict[str, Any] | None = None) -> None:
        self.intent = intent
        self.fields = fields or {}


def _run(monkeypatch: pytest.MonkeyPatch, intent: str, conversation=CONVERSATION, seen=None):
    async def fake_classify(_text):
        return _Action(intent, {"summary": "quiere ver el depto"})

    monkeypatch.setattr(extraction, "classify", fake_classify)
    monkeypatch.setattr(extraction, "load_snapshot", lambda _t: object())
    monkeypatch.setattr(extraction, "resolve", lambda *_a, **_k: object())

    def fake_dispatch(intent_name, _resolved, **kwargs):
        if seen is not None:
            seen.update(kwargs, intent=intent_name)
        return {"kind": "proposal", "proposal_id": str(uuid4())}

    monkeypatch.setattr(extraction, "dispatch", fake_dispatch)
    return asyncio.run(
        extraction.extract_from_inbound(
            tenant_id=TENANT,
            conversation=conversation,
            message_id="wamid.in",
            text="Hola, quiero ver el departamento de Ñuñoa el martes",
            proposed_by_user=None,
        )
    )


def test_a_clients_words_can_only_ever_propose(monkeypatch: pytest.MonkeyPatch) -> None:
    """The tenant may let Propo execute `create_event` unattended when the
    BROKER dictates it. A stranger saying "agenda una visita mañana" is not the
    broker, and must not reach the calendar."""
    seen: dict[str, Any] = {}
    _run(monkeypatch, "create_event", seen=seen)
    assert seen["force_level"] is AutonomyLevel.SUGGEST


def test_the_quote_rides_along(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}
    _run(monkeypatch, "create_task", seen=seen)
    evidence = seen["evidence"]
    assert "departamento de Ñuñoa" in evidence["quote"]
    assert evidence["source"] == "whatsapp"
    assert evidence["conversation_id"] == CONVERSATION["id"]
    assert evidence["client_message_id"] == "wamid.in"


@pytest.mark.parametrize("intent", ["create_property", "log_transaction", "create_person"])
def test_intents_a_client_has_no_business_triggering(monkeypatch: pytest.MonkeyPatch, intent: str) -> None:
    """A client can tell you something worth writing down and a time to meet.
    They cannot create a listing or move money, and a model that thinks
    otherwise should not be believed."""
    assert _run(monkeypatch, intent) is None


def test_an_unidentified_thread_proposes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    """There is nobody to attribute it to yet. A proposal against a bare phone
    number creates rows nobody can find afterwards."""
    unknown = {**CONVERSATION, "contact_id": None}
    assert _run(monkeypatch, "create_task", conversation=unknown) is None


def test_a_classifier_failure_is_silent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Extraction is best-effort: it must never cost the client their reply."""

    async def boom(_text):
        raise RuntimeError("groq down")

    monkeypatch.setattr(extraction, "classify", boom)
    result = asyncio.run(
        extraction.extract_from_inbound(
            tenant_id=TENANT,
            conversation=CONVERSATION,
            message_id="wamid.in",
            text="hola",
            proposed_by_user=None,
        )
    )
    assert result is None


def test_clarify_is_not_a_proposal(monkeypatch: pytest.MonkeyPatch) -> None:
    """Half an intent costs a human more to finish than to write themselves."""

    async def fake_classify(_text):
        return _Action("create_task", {})

    monkeypatch.setattr(extraction, "classify", fake_classify)
    monkeypatch.setattr(extraction, "load_snapshot", lambda _t: object())
    monkeypatch.setattr(extraction, "resolve", lambda *_a, **_k: object())
    monkeypatch.setattr(extraction, "dispatch", lambda *_a, **_k: {"kind": "clarify", "missing_fields": ["title"]})
    result = asyncio.run(
        extraction.extract_from_inbound(
            tenant_id=TENANT,
            conversation=CONVERSATION,
            message_id="wamid.in",
            text="hola",
            proposed_by_user=None,
        )
    )
    assert result is None
