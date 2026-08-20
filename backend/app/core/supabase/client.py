from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions as ClientOptions

from app.core.config.settings import settings

# Context-local override consulted by `get_supabase_client`.
#
# Feature code calls the getter deep inside call stacks, so a caller that needs
# request-scoped PostgREST headers (agent audit attribution) cannot pass a
# client down — it publishes one here instead. Mutating the shared client's
# headers is not an option: that object is process-global, so two concurrent
# requests would stamp each other's writes.
_scoped_client: ContextVar[Client | None] = ContextVar("supabase_scoped_client", default=None)


def _schema() -> str:
    """Target schema. `SUPABASE_DB_SCHEMA` lets integration tests mirror to
    `propos_test` — same DB, different schema, via Accept-Profile headers."""
    return os.environ.get("SUPABASE_DB_SCHEMA", "public")


@lru_cache(maxsize=1)
def _shared_client() -> Client:
    return create_client(  # pragma: no cover
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=ClientOptions(schema=_schema()),
    )


def build_client(headers: dict[str, str] | None = None, *, schema: str | None = None) -> Client:
    """A fresh service-role client, isolated from the shared one.

    Use when the caller needs its own PostgREST headers, or a different schema,
    for the duration of an operation. Costs one client construction, so it is
    for writes that need attribution and for the dev schema switch — not for the
    hot read path.
    """
    options = ClientOptions(schema=schema or _schema(), headers=dict(headers or {}))
    return create_client(settings.supabase_url, settings.supabase_service_role_key, options=options)


@contextmanager
def use_client(client: Client) -> Iterator[Client]:
    """Make `client` the one `get_supabase_client()` returns in this context.

    ContextVar scoping means an async task or a worker thread gets its own
    binding: concurrent requests cannot see each other's client.
    """
    token = _scoped_client.set(client)
    try:
        yield client
    finally:
        _scoped_client.reset(token)


def get_supabase_client() -> Client:
    """Service-role Supabase client — the context-scoped one if there is one."""
    scoped = _scoped_client.get()
    return scoped if scoped is not None else _shared_client()


# Historical entry point: callers (and tests) reset the singleton through the
# getter, which used to be the `lru_cache`-decorated function itself.
get_supabase_client.cache_clear = _shared_client.cache_clear  # type: ignore[attr-defined]
