"""Sliding-window rate limiting for the anonymous surface.

Not to be confused with `features/agent/rate_limiter.py`: that one paces our
outbound calls against a provider's quota and *waits*. This one guards our own
public routes against abuse and *rejects* with 429.

Scope and limits of this implementation, so nobody mistakes it for more than it
is:

* **Process-local.** Cloud Run runs several instances, so the effective ceiling
  is `limit x instances`. Good enough to turn an unbounded brute force into a
  slow one; not a substitute for a WAF.
* **In memory.** Counters reset on deploy. Swap `_Window` for Redis if a shared
  budget is ever needed — the dependency signature would not change.

Keying is explicit per route. Brute force against a share-link password targets
one *slug*, and rotating IPs is cheap, so that route is limited per slug;
anonymous uploads burn *our* storage, so those are limited per client.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


def client_ip(request: Request) -> str:
    """Best-effort caller identity.

    Behind a proxy the direct peer is the load balancer, so prefer
    `X-Forwarded-For` — and read it right-to-left. A client can prepend
    whatever it likes to that header, but it cannot remove the hop the proxy
    appends, so the rightmost entry is the one it does not control. Worst case
    (several proxy hops) callers share a bucket and we over-limit, which is the
    safe direction to be wrong in.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
        if hops:
            return hops[-1]
    return request.client.host if request.client else "unknown"


def by_ip(request: Request) -> str:
    return client_ip(request)


def by_path_param(name: str) -> Callable[[Request], str]:
    """Key on a path parameter — used to bound attempts against one resource."""

    def key(request: Request) -> str:
        return str(request.path_params.get(name, ""))

    return key


# Above this many tracked keys, sweep the ones that have gone quiet. Keeps a
# spray of one-off IPs from growing the map without bound.
_SWEEP_THRESHOLD = 4096


class _Window:
    """Per-bucket sliding window of hit timestamps."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: float, now: float) -> float | None:
        """Record a hit, or return the seconds to wait when the window is full."""
        cutoff = now - window_seconds
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                return hits[0] + window_seconds - now
            hits.append(now)
            if len(self._hits) > _SWEEP_THRESHOLD:
                self._sweep(cutoff)
            return None

    def _sweep(self, cutoff: float) -> None:
        """Drop keys whose whole window has expired. Caller holds the lock."""
        stale = [k for k, hits in self._hits.items() if not hits or hits[-1] <= cutoff]
        for k in stale:
            del self._hits[k]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_WINDOWS: dict[str, _Window] = defaultdict(_Window)


def reset_all() -> None:
    """Drop every counter. For tests — never call this from request handlers."""
    for window in _WINDOWS.values():
        window.reset()
    _WINDOWS.clear()


def rate_limit(
    bucket: str,
    *,
    limit: int,
    window_seconds: float,
    key: Callable[[Request], str] = by_ip,
) -> Callable:
    """Dependency that allows `limit` requests per `window_seconds` per key."""

    async def limiter(request: Request) -> None:
        retry_after = _WINDOWS[bucket].check(key(request), limit, window_seconds, time.monotonic())
        if retry_after is None:
            return
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
            headers={"Retry-After": str(max(1, int(retry_after)))},
        )

    return limiter
