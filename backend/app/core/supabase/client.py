from __future__ import annotations

import os
import threading
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


_thread_local = threading.local()


def get_thread_client() -> Client:
    """A service-role client this thread alone uses.

    The shared client wraps one synchronous httpx session over a single HTTP/2
    connection, and httpx's sync transport does not guard that connection's
    state machine against use from several threads at once. Fanning reads out
    with `asyncio.to_thread` over the shared client therefore corrupted the
    stream and the server hung up mid-response — `httpcore.RemoteProtocolError:
    Server disconnected`, in production, on the first request to
    `/v1/attention`. One client per worker thread keeps every connection to a
    single user, and because the executor reuses its threads the construction
    cost is paid once per thread rather than once per call.

    Read paths only. This deliberately ignores the context-scoped client, so a
    caller that needs request-scoped PostgREST headers (agent audit
    attribution) must not fan its writes out through here.
    """
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = build_client()
        _thread_local.client = client
    return client


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


def has_scoped_client() -> bool:
    """True when a request-scoped client is in effect.

    Exists for the auth cache. `DevSchemaMiddleware` wraps the WHOLE request —
    dependency resolution included — in a client bound to another schema, so a
    cache keyed only by token or user id would serve a `public` profile to a
    `propos_test` request. Bypassing while a scoped client is active is
    provably leak-free, where a schema key component would only be leak-free if
    the key were right.

    Cheap to bypass: the only other `use_client` caller is the agent's audit
    attribution, which is entered inside a router body long after auth resolved,
    and `X-Db-Schema` is installed only when APP_ENV is development.
    """
    return _scoped_client.get() is not None


# Historical entry point: callers (and tests) reset the singleton through the
# getter, which used to be the `lru_cache`-decorated function itself.
get_supabase_client.cache_clear = _shared_client.cache_clear  # type: ignore[attr-defined]
