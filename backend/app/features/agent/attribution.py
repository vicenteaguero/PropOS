"""Audit attribution for writes the agent performs.

The universal `audit_log` trigger reads `app.action_source` and
`app.agent_session_id`, which PostgREST populates from the `X-Action-Source`
and `X-Agent-Session-Id` request headers (migration 0033).

Two things were wrong. The auto-commit path — the default for 10 of the 12
intents — never stamped them, so those rows landed unattributed. And the
stamping itself wrote onto the headers of the `@lru_cache`d Supabase client,
which is one object for the whole process: a `try/finally` around it isolates
nothing, so a concurrent write (email sync runs in a thread pool) could be
labelled with another user's agent session.

Both paths now enter this context manager, and it works on a client of its
own, published through `use_client` so `get_supabase_client()` returns it for
the duration of the block and only inside this context.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

AGENT_SESSION_HEADER = "X-Agent-Session-Id"
ACTION_SOURCE_HEADER = "X-Action-Source"
ACTION_SOURCE_AGENT = "agent"


@contextmanager
def agent_attribution(session_id: UUID | str | None) -> Iterator[None]:
    """Stamp agent attribution on every Supabase write made inside the block."""
    from app.core.supabase.client import build_client, use_client

    if session_id is None:
        yield
        return

    headers = {
        AGENT_SESSION_HEADER: str(session_id),
        ACTION_SOURCE_HEADER: ACTION_SOURCE_AGENT,
    }
    client = build_client(headers)
    # Also set them on the live session: `build_client` seeds them at
    # construction, and re-stating them here keeps the contract explicit and
    # survives a client whose options plumbing changes under us.
    session_headers = getattr(getattr(client, "postgrest", None), "session", None)
    session_headers = getattr(session_headers, "headers", None)
    if session_headers is not None:
        session_headers.update(headers)
    try:
        with use_client(client):
            yield
    finally:
        if session_headers is not None:
            session_headers.pop(AGENT_SESSION_HEADER, None)
            session_headers.pop(ACTION_SOURCE_HEADER, None)
        _close(client)


def _close(client) -> None:
    """Release the ephemeral client's HTTP connections; never fatal."""
    try:
        client.postgrest.session.close()
    except Exception:  # noqa: BLE001 - best effort, the GC gets it otherwise
        pass
