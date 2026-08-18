"""Audit attribution for writes the agent performs.

The universal `audit_log` trigger reads `app.action_source` and
`app.agent_session_id`, which PostgREST populates from the `X-Action-Source`
and `X-Agent-Session-Id` request headers (migration 0033).

Only the manual accept path used to stamp them, so the auto-commit path — the
default for 10 of the 12 intents — wrote domain rows the audit log could not
attribute to Propo. Both paths now go through this one context manager.
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
    from app.core.supabase.client import get_supabase_client

    if session_id is None:
        yield
        return

    headers = get_supabase_client().postgrest.session.headers
    headers[AGENT_SESSION_HEADER] = str(session_id)
    headers[ACTION_SOURCE_HEADER] = ACTION_SOURCE_AGENT
    try:
        yield
    finally:
        headers.pop(AGENT_SESSION_HEADER, None)
        headers.pop(ACTION_SOURCE_HEADER, None)
