"""Backoff around provider chat completions (llm_retry.with_retry)."""

from __future__ import annotations

import httpx
import openai
import pytest

from app.features.agent import llm_retry
from app.features.agent.llm_retry import LLMUnavailableError, is_retryable, retry_after_seconds, with_retry


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    monkeypatch.setattr(llm_retry.asyncio, "sleep", fake_sleep)
    return slept


def _status_error(status: int, headers: dict[str, str] | None = None) -> openai.APIStatusError:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(status, headers=headers or {}, request=request)
    cls = openai.RateLimitError if status == 429 else openai.APIStatusError
    return cls("boom", response=response, body=None)


def test_retryable_classification():
    assert is_retryable(_status_error(429))
    assert is_retryable(_status_error(503))
    assert is_retryable(openai.APIConnectionError(request=httpx.Request("POST", "https://x")))
    assert not is_retryable(_status_error(400))
    assert not is_retryable(ValueError("nope"))


def test_retry_after_header_is_read_and_capped():
    assert retry_after_seconds(_status_error(429, {"retry-after": "2"})) == 2.0
    assert retry_after_seconds(_status_error(429, {"retry-after": "600"})) == llm_retry.MAX_RETRY_AFTER_SECONDS
    assert retry_after_seconds(_status_error(429)) is None


async def test_transient_failure_then_success():
    attempts = [0]

    async def call():
        attempts[0] += 1
        if attempts[0] < 3:
            raise _status_error(429)
        return "ok"

    assert await with_retry(call, what="classify") == "ok"
    assert attempts[0] == 3


async def test_exhausted_budget_raises_llm_unavailable():
    async def call():
        raise _status_error(503)

    with pytest.raises(LLMUnavailableError):
        await with_retry(call, what="classify")


async def test_non_retryable_error_propagates_untouched():
    async def call():
        raise _status_error(400)

    with pytest.raises(openai.APIStatusError):
        await with_retry(call, what="classify")


async def test_retry_after_drives_the_wait(_no_real_sleep):
    attempts = [0]

    async def call():
        attempts[0] += 1
        if attempts[0] == 1:
            raise _status_error(429, {"retry-after": "3"})
        return "ok"

    await with_retry(call, what="classify")
    assert 3.0 <= _no_real_sleep[0] <= 3.3
