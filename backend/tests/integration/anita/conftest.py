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

from .seed_anita import SeedHandles, cleanup, seed


def pytest_configure(config: pytest.Config) -> None:  # noqa: D401
    config.addinivalue_line(
        "markers",
        "integration: hits real Supabase + LLM providers (slow, costs tokens).",
    )


def _missing_env() -> list[str]:
    needed = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    return [k for k in needed if not os.environ.get(k)]


TEST_SCHEMA = os.environ.get("ANITA_TEST_SCHEMA", "propos_test")


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
    """Route Supabase calls to `propos_test` if PostgREST exposes it.

    Same DB, different schema — set via Supabase dashboard → API →
    Exposed Schemas, or in `supabase/config.toml` `[api] schemas`. If the
    schema isn't exposed, fall back to `public` and rely on
    tenant_id-scoped isolation (cleanup deletes by tenant_id).
    """
    from app.core.supabase.client import get_supabase_client

    # Make sure cached client picks up whatever was set previously.
    get_supabase_client.cache_clear()

    if _schema_is_exposed(TEST_SCHEMA):
        prev = os.environ.get("SUPABASE_DB_SCHEMA")
        os.environ["SUPABASE_DB_SCHEMA"] = TEST_SCHEMA
        get_supabase_client.cache_clear()
        active = TEST_SCHEMA
    else:
        prev = os.environ.get("SUPABASE_DB_SCHEMA")
        os.environ.pop("SUPABASE_DB_SCHEMA", None)
        get_supabase_client.cache_clear()
        active = "public"
        import warnings
        warnings.warn(
            f"PostgREST has not exposed schema {TEST_SCHEMA!r}; falling back to "
            "'public' + tenant scoping. Add it under Project Settings → API → "
            "Exposed Schemas in the Supabase dashboard for full isolation.",
            stacklevel=2,
        )

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
if os.environ.get("ANITA_TEST_FULL"):
    _DEFAULT = ["groq", "cerebras", "anthropic", "openai"]

PROVIDERS = [p for p in _DEFAULT if os.environ.get(f"{p.upper()}_API_KEY")]


@pytest.fixture(params=PROVIDERS or ["__none__"])
def provider(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> str:
    if request.param == "__none__":
        pytest.skip("Set CEREBRAS_API_KEY or GROQ_API_KEY to run.")
    monkeypatch.setenv("ANITA_PROVIDER", request.param)
    return request.param
