"""`run_chat_turn` must never let an exception reach the SSE stream raw.

The frontend only understands text/tool_use/done; a stream that stops mid-turn
renders as a frozen chat with no message.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

import pytest

from app.features.agent import chat
from app.features.agent.llm_retry import LLMUnavailableError

IDS = dict(session_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())


async def _collect(**kwargs: Any) -> list[dict[str, Any]]:
    return [e async for e in chat.run_chat_turn(user_text="hola", **IDS, **kwargs)]


def _raise(exc: Exception):
    async def fake(*_a: Any, **_kw: Any) -> AsyncIterator[dict[str, Any]]:
        yield {"type": "text", "text": "parcial"}
        raise exc

    return fake


async def test_llm_unavailable_degrades_to_text_and_done(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat, "_stream_turn", _raise(LLMUnavailableError("groq 503")))
    events = await _collect()
    assert [e["type"] for e in events] == ["text", "text", "done"]
    assert "IA no está respondiendo" in events[1]["text"]
    assert events[-1]["error"] == "llm_unavailable"


async def test_unexpected_error_degrades_to_text_and_done(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat, "_stream_turn", _raise(RuntimeError("postgrest exploded")))
    events = await _collect()
    assert [e["type"] for e in events] == ["text", "text", "done"]
    assert events[-1]["error"] == "turn_failed"


async def test_done_event_always_carries_the_keys_the_frontend_reads(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(chat, "_stream_turn", _raise(RuntimeError("boom")))
    done = (await _collect())[-1]
    assert done["proposals_created"] == []
    assert done["executed_rows"] == []
