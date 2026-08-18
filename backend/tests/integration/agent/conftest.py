"""Anita integration test fixtures.

These tests need a running Supabase + an LLM provider key. They are
gated by a pytest marker so a plain `pytest` run skips them.

Enable with: `pytest -m integration` (requires env: SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, plus at least one of CEREBRAS_API_KEY /
GROQ_API_KEY).
"""

from __future__ import annotations

import json
import os
import time
from collections.abc import Generator
from pathlib import Path

import pytest

from .seed_agent import SeedHandles, cleanup, seed

# ── results.jsonl completeness ───────────────────────────────────────
#
# The capability matrix writes its row *after* the turn returns, so a test that
# died on an exception (429, timeout, retired model) simply vanished from the
# report — a run of 18 passes and 4 crashes produced a file that read 18/18,
# 100%. The hooks below guarantee one row per test whatever happens, and close
# the file with a summary so nobody has to count lines to know the pass rate.

RESULTS_PATH = Path(__file__).parent / "results.jsonl"
_ROWS_BEFORE: dict[str, int] = {}
_ROWS_AT_SESSION_START = 0


def _row_count() -> int:
    if not RESULTS_PATH.exists():
        return 0
    with RESULTS_PATH.open() as f:
        return sum(1 for line in f if line.strip())


def _append(record: dict[str, object]) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RESULTS_PATH.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def pytest_sessionstart(session: pytest.Session) -> None:
    # Remember the baseline so a plain unit run, which collects this directory
    # but executes none of it, does not append a summary to a stale file.
    global _ROWS_AT_SESSION_START
    _ROWS_AT_SESSION_START = _row_count()


def pytest_runtest_setup(item: pytest.Item) -> None:
    _ROWS_BEFORE[item.nodeid] = _row_count()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):  # type: ignore[no-untyped-def]
    outcome = yield
    report = outcome.get_result()

    # A setup failure never reaches the test body; a call failure may or may not
    # have got as far as the test's own _record.
    if report.when == "call":
        before = _ROWS_BEFORE.pop(item.nodeid, None)
        if before is not None and _row_count() > before:
            return  # the test logged its own, richer row
    elif not (report.when == "setup" and report.failed):
        return

    params = getattr(item, "callspec", None)
    _append(
        {
            "test": item.nodeid,
            "provider": (params.params.get("provider") if params else None) or "?",
            "pass": report.passed,
            "ts": time.time(),
            "phase": report.when,
            "error": (str(call.excinfo.value)[:300] if call.excinfo else None),
            "error_type": (call.excinfo.type.__name__ if call.excinfo else None),
            "source": "harness",  # synthesised, so the row is never missing
        }
    )


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    if _row_count() <= _ROWS_AT_SESSION_START:
        return  # nothing ran in this directory

    rows = []
    if RESULTS_PATH.exists():
        for line in RESULTS_PATH.read_text().splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not row.get("summary"):
                rows.append(row)
    if not rows:
        return

    passed = sum(1 for r in rows if r.get("pass"))
    _append(
        {
            "summary": True,
            "ts": time.time(),
            "n": len(rows),
            "passed": passed,
            "pass_rate": round(passed / len(rows), 3),
            "model": os.environ.get("AGENT_MODEL", "?"),
            "schema": TEST_SCHEMA,
            "exit_status": int(exitstatus),
        }
    )


def pytest_configure(config: pytest.Config) -> None:  # noqa: D401
    config.addinivalue_line(
        "markers",
        "integration: hits real Supabase + LLM providers (slow, costs tokens).",
    )


def _missing_env() -> list[str]:
    needed = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    return [k for k in needed if not os.environ.get(k)]


TEST_SCHEMA = os.environ.get("AGENT_TEST_SCHEMA", "propos_test")


def _schema_is_exposed(schema: str) -> bool:
    """Probe PostgREST: does it know about this schema?"""
    from app.core.supabase.client import get_supabase_client

    try:
        get_supabase_client().schema(schema).table("tenants").select("id").limit(1).execute()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session", autouse=True)
def _route_to_test_schema() -> Generator[str, None, None]:
    """Route Supabase calls to `propos_test`, or refuse to run.

    Same DB, different schema — exposed via `supabase/config.toml` `[api]
    schemas` (and Project Settings → API → Exposed Schemas). There is a single
    Supabase project and `public` is production, so an unreachable test schema
    is a hard stop: the previous behaviour was to warn and silently write to
    production, which nobody reads in CI output.

    If the probe fails, rebuild the schema with `make test-schema-rebuild`.
    """
    from app.core.supabase.client import get_supabase_client

    # Make sure cached client picks up whatever was set previously.
    get_supabase_client.cache_clear()

    if not _schema_is_exposed(TEST_SCHEMA):
        pytest.exit(
            f"PostgREST does not expose schema {TEST_SCHEMA!r}. Refusing to run "
            "integration tests against 'public' — that is the production schema. "
            "Fix: `make test-schema-rebuild`, and check `[api] schemas` in "
            "supabase/config.toml.",
            returncode=1,
        )

    prev = os.environ.get("SUPABASE_DB_SCHEMA")
    os.environ["SUPABASE_DB_SCHEMA"] = TEST_SCHEMA
    get_supabase_client.cache_clear()
    active = TEST_SCHEMA

    yield active

    if prev is None:
        os.environ.pop("SUPABASE_DB_SCHEMA", None)
    else:
        os.environ["SUPABASE_DB_SCHEMA"] = prev
    get_supabase_client.cache_clear()


@pytest.fixture(scope="session")
def seed_handles(_route_to_test_schema: str) -> Generator[SeedHandles, None, None]:
    missing = _missing_env()
    if missing:
        pytest.skip(f"Anita integration tests need env: {', '.join(missing)}")
    handles = seed()
    yield handles
    cleanup(handles)


_DEFAULT = ["groq"]
if os.environ.get("AGENT_TEST_FULL"):
    _DEFAULT = ["groq", "cerebras", "anthropic", "openai"]

PROVIDERS = [p for p in _DEFAULT if os.environ.get(f"{p.upper()}_API_KEY")]


@pytest.fixture(params=PROVIDERS or ["__none__"])
def provider(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> str:
    if request.param == "__none__":
        pytest.skip("Set CEREBRAS_API_KEY or GROQ_API_KEY to run.")
    monkeypatch.setenv("AGENT_PROVIDER", request.param)
    return request.param
