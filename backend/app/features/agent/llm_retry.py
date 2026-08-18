"""Retry policy for provider chat completions.

Every model call in the pipeline used to be a bare ``await`` with no
``except``: a 429 from Groq, a dropped socket or a read timeout surfaced as a
500 (or a truncated SSE stream) with no message for the broker.

The classifier is one call on the hot path, so a couple of short retries are
cheap insurance. Retries are bounded by ``MAX_ATTEMPTS`` and by the caller's
per-turn timeout; ``retry-after`` from the provider wins over the local
backoff when present.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.core.logging.logger import get_logger

logger = get_logger("AGENT_LLM_RETRY")

T = TypeVar("T")

MAX_ATTEMPTS = 3
BASE_DELAY_SECONDS = 0.5
MAX_DELAY_SECONDS = 8.0
# Never honour a retry-after longer than this — the user is waiting on an open
# SSE stream, so a 60s provider hint is worse than failing fast.
MAX_RETRY_AFTER_SECONDS = 10.0


class LLMUnavailableError(RuntimeError):
    """The provider kept failing after the retry budget was spent."""


def is_retryable(exc: BaseException) -> bool:
    """True for transient provider failures (429, 5xx, timeouts, socket drops)."""
    import openai

    if isinstance(exc, openai.APITimeoutError | openai.APIConnectionError | openai.RateLimitError):
        return True
    if isinstance(exc, openai.APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return False


def retry_after_seconds(exc: BaseException) -> float | None:
    """Read ``retry-after`` off the provider response, capped."""
    headers = getattr(getattr(exc, "response", None), "headers", None)
    if not headers:
        return None
    raw = headers.get("retry-after") or headers.get("Retry-After")
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(value, MAX_RETRY_AFTER_SECONDS))


async def with_retry(call: Callable[[], Awaitable[T]], *, what: str) -> T:
    """Run ``call`` with exponential backoff on transient provider errors.

    Non-retryable errors propagate untouched (a bad request is a bug, not a
    blip). Exhausting the budget raises ``LLMUnavailableError`` so the caller can
    degrade with a message instead of a 500.
    """
    delay = BASE_DELAY_SECONDS
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return await call()
        except Exception as exc:
            if not is_retryable(exc):
                raise
            if attempt == MAX_ATTEMPTS:
                logger.warning(
                    "llm_call_exhausted",
                    event_type="llm",
                    what=what,
                    attempts=attempt,
                    error=str(exc)[:200],
                )
                raise LLMUnavailableError(f"{what}: {exc}") from exc
            wait = retry_after_seconds(exc)
            if wait is None:
                wait = min(delay, MAX_DELAY_SECONDS)
                delay *= 2
            # Jitter so concurrent turns don't retry in lockstep.
            wait += random.uniform(0.0, 0.25)
            logger.info(
                "llm_call_retry",
                event_type="llm",
                what=what,
                attempt=attempt,
                wait_ms=int(wait * 1000),
                error=str(exc)[:200],
            )
            await asyncio.sleep(wait)
    raise LLMUnavailableError(what)  # pragma: no cover - loop always returns or raises
