"""Run the synchronous Supabase client without stalling the event loop.

The problem this exists for: 254 route handlers are declared `async def`, but
the Supabase client is synchronous. An `async def` handler that never awaits
still occupies the event loop for the entire duration of every HTTP round trip
it makes — and a round trip to Supabase measures ~163 ms from Cloud Run. So a
handler reading four tables held the whole worker for two thirds of a second,
and every unrelated request queued behind it. With two uvicorn workers the real
concurrency of an instance was about two.

`attention/service.py` solved this locally with its own `_gather`; this is that
idea, shared, plus the part `_gather` leaves to its caller.

THE PART THAT IS EASY TO GET WRONG: the process-wide client wraps one
synchronous httpx session over a single HTTP/2 connection, and httpx's sync
transport does not guard that connection's state machine against concurrent
use. Fanning reads out over the shared client corrupted the stream and the
server hung up mid-response — `httpcore.RemoteProtocolError: Server
disconnected`, in production, on the first request to `/v1/attention`. That is
why `get_thread_client()` exists.

Rather than making every call site remember, `run_blocking` publishes the
thread's own client on the ContextVar that `get_supabase_client()` already
consults. Service code needs no changes: it keeps calling
`get_supabase_client()` and transparently gets a client that belongs to the
thread it is running on. `asyncio.to_thread` copies the context into the
worker, and the `use_client` binding made inside applies only to that copy, so
two concurrent requests cannot see each other's client.

READS ONLY. This deliberately overrides any request-scoped client, so a caller
that needs request-scoped PostgREST headers — the agent's audit attribution —
must not route its writes through here, or the attribution is lost.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any, TypeVar

from app.core.supabase.client import get_thread_client, use_client

T = TypeVar("T")


def _in_thread(fn: Callable[..., T], args: tuple, kwargs: dict) -> T:
    with use_client(get_thread_client()):
        return fn(*args, **kwargs)


async def run_blocking(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Await a blocking read on a worker thread, with a thread-safe client."""
    return await asyncio.to_thread(_in_thread, fn, args, kwargs)


async def gather_blocking(*calls: Callable[[], Any]) -> list[Any]:
    """Run several blocking reads at once, each on its own worker thread.

    For a handler that reads N independent tables: end to end that is N network
    latencies stacked, concurrently it is one. Every call gets its own thread
    client, which is what makes the fan-out safe.
    """
    return list(await asyncio.gather(*(run_blocking(call) for call in calls)))
