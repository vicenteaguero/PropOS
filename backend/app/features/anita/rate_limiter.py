"""Per-(provider, model) sliding-window rate limiter.

Process-local singleton. Maintains four windows per model — req-min,
req-day, tok-min, tok-day — built from the registry in
``rate_limits.py``. The flow:

1. Caller estimates token cost (rough: ``len(prompt) // 4``).
2. ``await acquire(provider, model, est_tokens)`` blocks via
   ``asyncio.sleep`` until every window has budget for one more
   request and ``est_tokens`` more tokens.
3. After the response lands, caller invokes
   ``record_response(provider, model, actual_tokens, headers)``. Token
   counts are reconciled with the real cost; headers
   (``x-ratelimit-remaining-*``, ``x-ratelimit-reset-*``) override
   the local counters to track the provider's authoritative state.

Designed for a single-process pytest run. Concurrency-safe within a
process (``asyncio.Lock``). For workers / Celery, swap the storage for
Redis — same interface.
"""

from __future__ import annotations

import asyncio
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from functools import lru_cache
from collections.abc import Iterable

from app.core.logging.logger import get_logger
from app.features.anita.rate_limits import ModelLimits, get_limits

logger = get_logger("ANITA_RATE_LIMIT")

_MIN = 60.0
_DAY = 86_400.0


@dataclass
class _Bucket:
    """One sliding window. Stores ``(timestamp, weight)`` events."""

    span_seconds: float
    cap: int
    events: deque[tuple[float, int]] = field(default_factory=deque)

    def prune(self, now: float) -> None:
        cutoff = now - self.span_seconds
        while self.events and self.events[0][0] < cutoff:
            self.events.popleft()

    def total(self, now: float) -> int:
        self.prune(now)
        return sum(w for _, w in self.events)

    def add(self, now: float, weight: int) -> None:
        if weight > 0:
            self.events.append((now, weight))

    def time_until_room(self, now: float, cost: int) -> float:
        """Seconds until ``self.total + cost <= self.cap``."""
        self.prune(now)
        if self.cap == 0:
            return 0.0
        used = sum(w for _, w in self.events)
        if used + cost <= self.cap:
            return 0.0
        # Walk events oldest-first; once enough of them age out, we'll fit.
        running = used
        for ts, weight in self.events:
            running -= weight
            if running + cost <= self.cap:
                return max(0.0, (ts + self.span_seconds) - now)
        # Cost alone exceeds the cap — wait the full window.
        return self.span_seconds


@dataclass
class _ModelState:
    req_min: _Bucket
    req_day: _Bucket
    tok_min: _Bucket
    tok_day: _Bucket
    lock: threading.Lock = field(default_factory=threading.Lock)

    @classmethod
    def from_limits(cls, limits: ModelLimits) -> _ModelState:
        return cls(
            req_min=_Bucket(_MIN, limits.rpm),
            req_day=_Bucket(_DAY, limits.rpd),
            tok_min=_Bucket(_MIN, limits.tpm),
            tok_day=_Bucket(_DAY, limits.tpd),
        )

    def all_buckets(self) -> Iterable[tuple[str, _Bucket]]:
        yield "req_min", self.req_min
        yield "req_day", self.req_day
        yield "tok_min", self.tok_min
        yield "tok_day", self.tok_day


class RateLimiter:
    """In-process sliding-window limiter. Use ``get_rate_limiter()``."""

    def __init__(self) -> None:
        self._states: dict[tuple[str, str], _ModelState] = {}
        self._states_lock = threading.Lock()

    def _state_for(self, provider: str, model: str) -> _ModelState | None:
        limits = get_limits(provider, model)
        if limits is None:
            return None
        key = (provider, model)
        with self._states_lock:
            state = self._states.get(key)
            if state is None:
                state = _ModelState.from_limits(limits)
                self._states[key] = state
        return state

    def _compute_wait(self, state: _ModelState, est_tokens: int) -> tuple[str, float] | None:
        """Return (window_label, seconds_to_wait) or None when budget OK.

        Side effect: when None is returned, the caller's cost is recorded
        in every bucket (single critical section). Caller must hold
        ``state.lock``.
        """
        now = time.monotonic()
        items = (
            ("req_min", state.req_min, 1),
            ("req_day", state.req_day, 1),
            ("tok_min", state.tok_min, est_tokens),
            ("tok_day", state.tok_day, est_tokens),
        )
        waits = [(label, b.time_until_room(now, cost)) for label, b, cost in items]
        worst = max(waits, key=lambda x: x[1])
        if worst[1] > 0:
            return worst
        for _, bucket, cost in items:
            bucket.add(now, cost)
        return None

    async def acquire(self, provider: str, model: str, est_tokens: int) -> None:
        state = self._state_for(provider, model)
        if state is None:
            return
        while True:
            with state.lock:
                wait = self._compute_wait(state, est_tokens)
            if wait is None:
                return
            logger.info(
                "rate_limit_wait",
                event_type="rate_limit",
                provider=provider,
                model=model,
                window=wait[0],
                wait_ms=int(wait[1] * 1000),
                est_tokens=est_tokens,
            )
            await asyncio.sleep(wait[1] + 0.05)

    def acquire_sync(self, provider: str, model: str, est_tokens: int) -> None:
        """Blocking variant for callers outside an event loop (e.g. Whisper)."""
        state = self._state_for(provider, model)
        if state is None:
            return
        while True:
            with state.lock:
                wait = self._compute_wait(state, est_tokens)
            if wait is None:
                return
            logger.info(
                "rate_limit_wait",
                event_type="rate_limit",
                provider=provider,
                model=model,
                window=wait[0],
                wait_ms=int(wait[1] * 1000),
                est_tokens=est_tokens,
            )
            time.sleep(wait[1] + 0.05)

    def record_response(
        self,
        provider: str,
        model: str,
        actual_tokens: int,
        headers: dict[str, str] | None = None,
    ) -> None:
        """Reconcile estimated token cost with real usage + provider state."""
        key = (provider, model)
        state = self._states.get(key)
        if state is None:
            return

        now = time.monotonic()
        # We added est_tokens during acquire(); the true cost may differ.
        # Adjust by appending the delta (positive or as zero — we never remove).
        # Headers, when present, are the authoritative source.
        if headers:
            self._sync_from_headers(state, headers, now)
            return

        if actual_tokens > 0:
            # Add a correction event sized to the residual delta. We don't
            # know the original est exactly here; in practice the est is a
            # lower bound, so add the response (output) tokens as extra.
            state.tok_min.add(now, actual_tokens)
            state.tok_day.add(now, actual_tokens)

    @staticmethod
    def _sync_from_headers(state: _ModelState, headers: dict[str, str], now: float) -> None:
        """Override local window totals with provider-reported counters.

        Groq labels these in a non-obvious way (per their docs):
          - ``x-ratelimit-*-requests`` → **Requests per DAY** (RPD)
          - ``x-ratelimit-*-tokens``   → **Tokens per MINUTE** (TPM)

        We sync each header to the matching bucket on our side. Local
        `req_min` and `tok_day` are kept by the running counters from
        ``acquire`` since the headers don't expose them.
        """

        def _g(name: str) -> str | None:
            return headers.get(name) or headers.get(name.lower())

        # requests → req_DAY (Groq labels them as RPD)
        for header_kind, bucket in (
            ("requests", state.req_day),
            ("tokens", state.tok_min),
        ):
            limit_s = _g(f"x-ratelimit-limit-{header_kind}")
            remaining_s = _g(f"x-ratelimit-remaining-{header_kind}")
            if not limit_s or not remaining_s:
                continue
            try:
                limit = int(float(limit_s))
                remaining = int(float(remaining_s))
            except ValueError:
                continue
            used = max(0, limit - remaining)
            bucket.events.clear()
            if used > 0:
                bucket.events.append((now, used))


@lru_cache(maxsize=1)
def get_rate_limiter() -> RateLimiter:
    return RateLimiter()
