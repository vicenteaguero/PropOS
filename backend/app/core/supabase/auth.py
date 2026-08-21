from __future__ import annotations

import time

import jwt
from supabase import Client

from app.core.supabase import auth_cache
from app.core.supabase.client import get_supabase_client, has_scoped_client

PROFILES_TABLE = "profiles"


def _token_deadline(token: str) -> float | None:
    """Absolute monotonic deadline implied by the token's own `exp`, if any.

    Decoded WITHOUT verifying the signature, and that is safe for exactly one
    reason: this value can only ever SHORTEN the cache entry's life (`put_token`
    takes a `min`). It is read from attacker-controllable input, so a token
    claiming `exp` in the year 3000 still gets the plain TTL. This is a courtesy
    so a nearly-expired token does not linger past its own death — not a
    security control. The security control is that the entry is only written
    after GoTrue verified the token.
    """
    try:
        claims = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
    except Exception:  # noqa: BLE001 - an opaque (non-JWT) token just gets the plain TTL
        return None
    exp = claims.get("exp")
    if not isinstance(exp, int | float):
        return None
    return time.monotonic() + max(exp - time.time(), 0.0)


def verify_token(token: str) -> dict:
    """Resolve a bearer token to its GoTrue user.

    Cached per token for a minute. `client.auth.get_user` is a network call to
    GoTrue and it ran on every single authenticated request — 25k of them in
    five days to answer the same question. See `auth_cache` for why the cache
    key is a hash of the whole token and why that is the property everything
    else rests on.
    """
    if has_scoped_client():
        # Dev schema switch: never read or write the cache. See has_scoped_client.
        return get_supabase_client().auth.get_user(token).user

    cached = auth_cache.get_token(token)
    if cached is not None:
        return cached

    client = get_supabase_client()
    response = client.auth.get_user(token)
    user = response.user
    if user is not None:
        # Only the success path is cached. A cached failure would lock a real
        # user out for a whole TTL over one transient GoTrue error.
        auth_cache.put_token(token, user, expires_at=_token_deadline(token))
    return user


def get_user_profile(user_id: str, client: Client | None = None) -> dict:
    """Return profile merged with the active tenant_membership fields.

    `is_dev_admin` and `view` now live only on tenant_memberships. We resolve
    the active membership by `profiles.tenant_id` (kept in sync by
    `activate_tenant`) and merge the two fields into the returned dict for
    backwards compatibility with `get_current_user`.

    Cached per user for 30 seconds — shorter than the token, because this dict
    carries `role`, `tenant_id` and `admin_scope`, i.e. the whole authorization
    payload. Every write that can change those calls
    `auth_cache.invalidate_profile`. An explicit `client` skips the cache: the
    caller has asked for a specific connection, so answering from a shared dict
    would ignore the request.
    """
    use_cache = client is None and not has_scoped_client()
    if use_cache:
        cached = auth_cache.get_profile(user_id)
        if cached is not None:
            return cached

    if client is None:
        client = get_supabase_client()
    response = client.table(PROFILES_TABLE).select("*").eq("id", user_id).single().execute()
    profile = response.data
    if not profile:
        return profile

    tenant_id = profile.get("tenant_id")
    if tenant_id:
        m = (
            client.table("tenant_memberships")
            .select("is_dev_admin, view")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        if m and m.data:
            profile["is_dev_admin"] = bool(m.data.get("is_dev_admin"))
            profile["view"] = m.data.get("view") or "agent"
        else:
            profile["is_dev_admin"] = False
            profile["view"] = "agent"
    else:
        profile["is_dev_admin"] = False
        profile["view"] = "agent"

    if use_cache:
        auth_cache.put_profile(user_id, profile)
    return profile
