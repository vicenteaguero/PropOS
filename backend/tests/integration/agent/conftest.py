"""Anita integration test fixtures.

These tests need a running Supabase + an LLM provider key. They are
gated by a pytest marker so a plain `pytest` run skips them.

Enable with: `pytest -m integration` (requires env: SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, plus at least one of CEREBRAS_API_KEY /
GROQ_API_KEY).
"""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest

from .seed_agent import SeedHandles, cleanup, seed


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
