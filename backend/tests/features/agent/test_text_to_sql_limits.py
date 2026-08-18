"""The freeform (text-to-SQL) path shares the classifier's provider quota."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.agent.rate_limiter import QuotaExhaustedError
from app.features.agent.tools import text_to_sql

TENANT = uuid4()


class _RecordingLimiter:
    def __init__(self, raise_on_acquire: bool = False) -> None:
        self.acquired: list[tuple[str, str, int]] = []
        self.recorded: list[int] = []
        self._raise = raise_on_acquire

    async def acquire(self, provider: str, model: str, est_tokens: int, *, max_wait: float | None = None) -> None:
        self.acquired.append((provider, model, est_tokens))
        if self._raise:
            raise QuotaExhaustedError(provider, model, "tok_day", 86_400.0)

    def record_response(self, provider: str, model: str, tokens: int, headers=None) -> None:
        self.recorded.append(tokens)


@pytest.fixture
def schema_hint(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(text_to_sql, "_load_schema_hint", lambda: "properties(id:uuid, tenant_id:uuid)")


async def test_quota_exhaustion_short_circuits_before_the_model(schema_hint, monkeypatch: pytest.MonkeyPatch):
    limiter = _RecordingLimiter(raise_on_acquire=True)
    monkeypatch.setattr(text_to_sql, "get_rate_limiter", lambda: limiter)

    def explode(*_a, **_kw):  # pragma: no cover - must not be reached
        raise AssertionError("model must not be called when the quota is spent")

    monkeypatch.setattr(text_to_sql, "with_retry", explode)

    result = await text_to_sql.generate_and_run_sql("cuántas propiedades tengo", TENANT)
    assert result == {"kind": "error", "reason": "quota_exhausted"}
    assert limiter.acquired and limiter.acquired[0][2] > 0


async def test_real_usage_is_reported_back_to_the_limiter(schema_hint, monkeypatch: pytest.MonkeyPatch):
    limiter = _RecordingLimiter()
    monkeypatch.setattr(text_to_sql, "get_rate_limiter", lambda: limiter)

    class _Usage:
        prompt_tokens = 800
        completion_tokens = 40

    class _Msg:
        content = "NO_SQL"

    class _Choice:
        message = _Msg()

    class _Completion:
        choices = [_Choice()]
        usage = _Usage()

    class _Raw:
        headers: dict[str, str] = {}

        def parse(self):
            return _Completion()

    async def fake_with_retry(call, *, what):
        return _Raw()

    monkeypatch.setattr(text_to_sql, "with_retry", fake_with_retry)

    result = await text_to_sql.generate_and_run_sql("pregunta rara", TENANT)
    assert result["kind"] == "out_of_scope"
    assert limiter.recorded == [840]
