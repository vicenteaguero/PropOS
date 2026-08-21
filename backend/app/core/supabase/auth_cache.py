"""In-process caches for the identity every authenticated request resolves.

`get_current_user` used to make three network round trips before a handler ran:
`auth.get_user(token)` against GoTrue, then a `profiles` read, then a
`tenant_memberships` read. Measured from Cloud Run (us-central1) to Supabase
(us-east-2) that is ~163 ms each, so roughly half a second of plumbing preceded
the one query the user actually asked for. Over five days production logged
25k GoTrue calls and 29k `profiles` reads to answer the same question over and
over.

Two caches rather than one, because their invalidation domains differ: a
workspace switch must drop the profile entry but must NOT drop the token entry
— the token has not changed, and re-verifying it is a wasted round trip.

SECURITY — the load-bearing properties, in order:

1. The token cache is keyed by a SHA-256 of the COMPLETE bearer token, never by
   the `sub` claim. A forged or tampered token hashes differently, misses, and
   is sent to GoTrue, which rejects it. Everything else here rests on this.
   The hash is a lookup key, not a secret: the only attack against it is a
   preimage on SHA-256.
2. Entries are written only after a successful verification. Failures are never
   cached — negative caching would lock a legitimate user out for a whole TTL
   over one transient GoTrue blip, and would invite a targeted denial of
   service. A token flood therefore still reaches GoTrue on every request;
   `app.core.rate_limit` is the mitigation for that, not this module.
3. `exp` may only ever SHORTEN an entry's life (`min`, never `max`). It is read
   from an unverified decode, so it is attacker-controlled input.
4. Nothing here is ever logged. A token hash in a log is a stable per-session
   identifier and, if this cache ever became shared, a replayable lookup key.

WORST CASE, stated plainly: a user whose authorization is reduced — membership
deactivated, role downgraded, scope narrowed — keeps the old level for up to
`_PROFILE_TTL_SECONDS` on each instance holding a warm entry, and their token
keeps verifying for up to `_TOKEN_TTL_SECONDS`.

That is acceptable, and not because "a minute is short". Supabase access tokens
are stateless JWTs: `auth.get_user` checks signature and expiry and consults no
revocation list, and there is no backend sign-out route — `signOut()` is
client-side and revokes the refresh token, not the access token. So a revoked
user's token ALREADY works against this API for the rest of its ~1 hour life,
today, with no cache at all. These TTLs sit two orders of magnitude inside an
exposure window the system already has. The real revocation levers (rotating
the JWT secret, deleting the GoTrue user) are delayed by at most one TTL.

The one thing that WOULD have been a new exposure — a revoked membership
surviving indefinitely once `resolve_active_tenant` stopped re-validating on
every request — is closed structurally by
`MembershipService._sync_profile_snapshot`, not by any TTL here.

CAVEAT, and it belongs in the design rather than in a footnote: Cloud Run runs
several instances and each holds its own dict. `invalidate_*` reaches one
process. **Invalidation is a latency optimisation, not a correctness
guarantee — the TTL is the only real bound.** Same trade-off
`agent/budget.py` documents for the spend cap, and the reason the profile TTL
is 30 seconds rather than 300: this has to be acceptable with no invalidation
at all.
"""

from __future__ import annotations

import copy
import hashlib
import math
import threading
import time
from typing import Any

#: The identity itself. Short because a miss costs one GoTrue round trip and
#: nothing else.
_TOKEN_TTL_SECONDS = 60.0
_TOKEN_CACHE_MAX = 512

#: Deliberately shorter than the token TTL: this entry carries `role`,
#: `tenant_id` and `admin_scope` — the whole authorization payload — and a miss
#: costs an indexed primary-key read, which is cheap next to GoTrue.
_PROFILE_TTL_SECONDS = 30.0
_PROFILE_CACHE_MAX = 512

# value = (monotonic deadline, payload)
_token_cache: dict[str, tuple[float, Any]] = {}
_profile_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()


def _now() -> float:
    """Seam so tests can advance time without sleeping."""
    return time.monotonic()


def _fresh(entry: tuple[float, Any] | None, now: float) -> bool:
    """An ABSOLUTE monotonic deadline, never `cached_at` compared to a TTL.

    `time.monotonic()`'s epoch is arbitrary — on Linux it is system uptime — so
    a `0.0` sentinel reads as *fresh* during a process's first minute, which is
    every fresh Cloud Run container and every CI runner. `budget.py` shipped
    that bug once already. Storing the deadline makes freshness correct at any
    epoch, and the default below is `-inf` rather than `0.0` for the same
    reason.
    """
    return entry is not None and now < entry[0]


def _evict(cache: dict[str, tuple[float, Any]], limit: int, now: float) -> None:
    """Sweep what has expired; if that was not enough, drop everything.

    Blunt on purpose, and the same shape as `agent/context.py`: the cost of
    over-evicting is one extra round trip, and a bounded dict is worth more than
    a clever policy. Caller holds the lock.
    """
    if len(cache) < limit:
        return
    for key in [k for k, entry in cache.items() if entry[0] <= now]:
        del cache[key]
    if len(cache) >= limit:
        cache.clear()


def token_key(token: str) -> str:
    """SHA-256 of the whole token. See property 1 in the module docstring."""
    return hashlib.sha256(token.encode()).hexdigest()


def get_token(token: str) -> Any | None:
    now = _now()
    with _lock:
        entry = _token_cache.get(token_key(token), (-math.inf, None))
        return entry[1] if _fresh(entry, now) else None


def put_token(token: str, user: Any, *, expires_at: float | None = None) -> None:
    """Cache a VERIFIED identity.

    `expires_at` is an absolute monotonic deadline the caller may pass to honour
    the token's own `exp`. It can only bring the deadline forward.
    """
    now = _now()
    deadline = now + _TOKEN_TTL_SECONDS
    if expires_at is not None:
        deadline = min(deadline, expires_at)
    with _lock:
        _evict(_token_cache, _TOKEN_CACHE_MAX, now)
        _token_cache[token_key(token)] = (deadline, user)


def get_profile(user_id: str) -> dict | None:
    """Return a DEEP COPY of the cached profile.

    Callers read `admin_scope` as a list and hand it to authorization checks.
    Nothing mutates it today, but a future caller that did would silently widen
    another request's permissions. A copy of a ten-key dict costs microseconds
    against a 163 ms round trip.
    """
    now = _now()
    with _lock:
        entry = _profile_cache.get(user_id, (-math.inf, None))
        return copy.deepcopy(entry[1]) if _fresh(entry, now) else None


def put_profile(user_id: str, profile: dict) -> None:
    now = _now()
    with _lock:
        _evict(_profile_cache, _PROFILE_CACHE_MAX, now)
        _profile_cache[user_id] = (now + _PROFILE_TTL_SECONDS, copy.deepcopy(profile))


def invalidate_profile(user_id: str | None = None) -> None:
    """Drop a cached profile after its authorization payload changed.

    Reaches this process only — see the caveat in the module docstring.
    """
    with _lock:
        if user_id is None:
            _profile_cache.clear()
        else:
            _profile_cache.pop(user_id, None)


def invalidate_token(token: str) -> None:
    with _lock:
        _token_cache.pop(token_key(token), None)


def reset_auth_caches() -> None:
    """Drop every cached identity. For tests — never call this from a handler."""
    with _lock:
        _token_cache.clear()
        _profile_cache.clear()
