"""Unit tests for the in-process rate limiter.

Drives the limiter directly with a fake `time.monotonic` so tests are
deterministic and run in milliseconds (no real sleeps).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from app.features.anita import rate_limiter as rl
from app.features.anita.rate_limits import ModelLimits


@pytest.fixture
def fake_clock(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[float]]:
    """Replaces `time.monotonic` and `time.sleep` so tests advance time
    by writing to the shared list `now[0]`.

    `time.sleep(s)` advances `now[0]` by `s` instead of blocking.
    """
    now = [0.0]

    def monotonic() -> float:
        return now[0]

    def sleep(seconds: float) -> None:
        now[0] += seconds

    monkeypatch.setattr(rl.time, "monotonic", monotonic)
    monkeypatch.setattr(rl.time, "sleep", sleep)
    yield now


@pytest.fixture
def limiter(monkeypatch: pytest.MonkeyPatch) -> rl.RateLimiter:
    # Pin LIMITS for the test (provider/model that won't change).
    test_limits = ModelLimits(rpm=30, rpd=1_000, tpm=12_000, tpd=100_000)
    monkeypatch.setattr(rl, "get_limits", lambda p, m: test_limits if (p, m) == ("test", "model") else None)
    # Fresh instance, not the cached singleton.
    rl.get_rate_limiter.cache_clear()
    return rl.RateLimiter()


def test_thirty_requests_in_a_minute_dont_block(fake_clock, limiter):
    """30 RPM cap → 30 fast requests fit, time stays at 0."""
    for _ in range(30):
        limiter.acquire_sync("test", "model", est_tokens=10)
    assert fake_clock[0] == pytest.approx(0.0, abs=0.01)


def test_thirty_first_request_waits_for_minute_reset(fake_clock, limiter):
    """31st request must sleep ~60s for the oldest of the 30 to age out."""
    for _ in range(30):
        limiter.acquire_sync("test", "model", est_tokens=10)
    limiter.acquire_sync("test", "model", est_tokens=10)
    # Slack 0.05 added in the limiter — total ~60.05.
    assert 59.5 < fake_clock[0] < 61.0


def test_token_window_blocks_when_estimate_exceeds_tpm(fake_clock, limiter):
    """Even one big request can blow tpm (12K). Two 7K requests → 2nd waits."""
    limiter.acquire_sync("test", "model", est_tokens=7_000)
    assert fake_clock[0] == pytest.approx(0.0, abs=0.01)
    limiter.acquire_sync("test", "model", est_tokens=7_000)
    assert 59.5 < fake_clock[0] < 61.0


def test_unregistered_model_is_no_op(fake_clock, limiter):
    """No `ModelLimits` entry → acquire returns instantly forever."""
    for _ in range(1_000):
        limiter.acquire_sync("test", "unknown", est_tokens=999_999)
    assert fake_clock[0] == 0.0


def test_record_response_with_headers_overrides_local_count(limiter):
    """Groq's headers map: ``*-requests`` → daily, ``*-tokens`` → per-minute.
    Sync should populate the matching bucket only."""
    state = limiter._state_for("test", "model")
    assert state is not None

    headers = {
        # Groq sends these as DAILY for requests, MINUTE for tokens.
        "x-ratelimit-limit-requests": "1000",
        "x-ratelimit-remaining-requests": "910",  # 90 used today
        "x-ratelimit-limit-tokens": "12000",
        "x-ratelimit-remaining-tokens": "9000",   # 3000 used this minute
    }
    limiter.record_response("test", "model", actual_tokens=0, headers=headers)

    state = limiter._state_for("test", "model")
    assert state is not None
    assert state.req_day.total(0.0) == 90      # synced from `requests` header
    assert state.req_min.total(0.0) == 0       # not touched
    assert state.tok_min.total(0.0) == 3000    # synced from `tokens` header
    assert state.tok_day.total(0.0) == 0       # not touched
