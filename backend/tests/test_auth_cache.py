"""Tests for the identity caches.

The interesting ones are not "does caching work" — they are the four properties
the module's security rests on: the key is the whole token, failures are never
cached, `exp` can only shorten, and a fresh process does not read absent keys as
warm.
"""

import time
from unittest.mock import MagicMock, patch

import jwt
import pytest

from app.core.supabase import auth_cache
from app.core.supabase.auth import get_user_profile, verify_token

USER_ID = "11111111-1111-1111-1111-111111111111"
TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


@pytest.fixture(autouse=True)
def _clean():
    auth_cache.reset_auth_caches()
    yield
    auth_cache.reset_auth_caches()


def _gotrue(mock_client, user_id: str = USER_ID) -> MagicMock:
    user = MagicMock()
    user.id = user_id
    mock_client.return_value.auth.get_user.return_value = MagicMock(user=user)
    return mock_client.return_value.auth.get_user


def _profile_table(mock_client, data: dict) -> MagicMock:
    table = MagicMock()
    for method in ("select", "eq", "single", "maybe_single"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data=data)
    mock_client.return_value.table.return_value = table
    return mock_client.return_value.table


# ── the token cache ───────────────────────────────────────────────────────────


@patch("app.core.supabase.auth.get_supabase_client")
def test_second_verify_of_the_same_token_skips_gotrue(mock_client):
    get_user = _gotrue(mock_client)

    verify_token("token-a")
    verify_token("token-a")

    get_user.assert_called_once_with("token-a")


@patch("app.core.supabase.auth.get_supabase_client")
def test_a_different_token_never_hits_a_cached_entry(mock_client):
    """The property everything rests on: the key is the whole token, so a
    forged one cannot name its way into a verified entry."""
    get_user = _gotrue(mock_client)

    verify_token("token-a")
    verify_token("token-b")

    assert get_user.call_count == 2


@patch("app.core.supabase.auth.get_supabase_client")
def test_failure_is_not_cached(mock_client):
    """A cached failure would lock a real user out for a whole TTL over one
    transient GoTrue error, and invites a targeted denial of service."""
    mock_client.return_value.auth.get_user.side_effect = RuntimeError("gotrue down")

    for _ in range(2):
        with pytest.raises(RuntimeError):
            verify_token("token-a")

    assert mock_client.return_value.auth.get_user.call_count == 2


@patch("app.core.supabase.auth.get_supabase_client")
def test_entry_expires(mock_client):
    get_user = _gotrue(mock_client)
    verify_token("token-a")

    with patch.object(auth_cache, "_now", lambda: time.monotonic() + 61):
        verify_token("token-a")

    assert get_user.call_count == 2


@patch("app.core.supabase.auth.get_supabase_client")
def test_a_near_expiry_token_dies_with_itself(mock_client):
    get_user = _gotrue(mock_client)
    token = jwt.encode({"sub": USER_ID, "exp": int(time.time()) + 5}, "irrelevant-signing-key-never-verified")

    verify_token(token)
    # Past the token's own exp but well inside the 60s cache TTL.
    with patch.object(auth_cache, "_now", lambda: time.monotonic() + 10):
        verify_token(token)

    assert get_user.call_count == 2


@patch("app.core.supabase.auth.get_supabase_client")
def test_a_far_future_exp_cannot_extend_the_ttl(mock_client):
    """`min`, never `max`. `exp` is read from an unverified decode, so it is
    attacker-controlled: it may only ever shorten the entry."""
    get_user = _gotrue(mock_client)
    token = jwt.encode({"sub": USER_ID, "exp": 32503680000}, "irrelevant-signing-key-never-verified")  # year 3000

    verify_token(token)
    with patch.object(auth_cache, "_now", lambda: time.monotonic() + 61):
        verify_token(token)

    assert get_user.call_count == 2


@patch("app.core.supabase.auth.get_supabase_client")
def test_an_opaque_token_still_caches(mock_client):
    """Supabase issues JWTs today; a future opaque token must not 500 the auth
    path, it should just fall back to the plain TTL."""
    get_user = _gotrue(mock_client)

    verify_token("not-a-jwt-at-all")
    verify_token("not-a-jwt-at-all")

    get_user.assert_called_once()


# ── the profile cache ─────────────────────────────────────────────────────────


@patch("app.core.supabase.auth.get_supabase_client")
def test_profile_is_cached_and_invalidated(mock_client):
    table = _profile_table(mock_client, {"id": USER_ID, "role": "ADMIN", "tenant_id": None})

    get_user_profile(USER_ID)
    first = table.call_count
    get_user_profile(USER_ID)
    assert table.call_count == first

    auth_cache.invalidate_profile(USER_ID)
    get_user_profile(USER_ID)
    assert table.call_count > first


@patch("app.core.supabase.auth.get_supabase_client")
def test_mutating_a_returned_profile_cannot_widen_the_next_request(mock_client):
    _profile_table(mock_client, {"id": USER_ID, "role": "AGENT", "admin_scope": ["crm"]})

    first = get_user_profile(USER_ID)
    first["admin_scope"].append("agent")
    first["role"] = "ADMIN"

    second = get_user_profile(USER_ID)
    assert second["admin_scope"] == ["crm"]
    assert second["role"] == "AGENT"


@patch("app.core.supabase.auth.get_supabase_client")
def test_an_explicit_client_bypasses_the_cache(mock_client):
    explicit = MagicMock()
    table = MagicMock()
    for method in ("select", "eq", "single", "maybe_single"):
        getattr(table, method).return_value = table
    table.execute.return_value = MagicMock(data={"id": USER_ID, "role": "AGENT"})
    explicit.table.return_value = table

    get_user_profile(USER_ID, client=explicit)
    get_user_profile(USER_ID, client=explicit)

    assert explicit.table.call_count == 2
    mock_client.assert_not_called()


# ── the dev-schema bypass ─────────────────────────────────────────────────────


@patch("app.core.supabase.auth.is_schema_overridden", return_value=True)
@patch("app.core.supabase.auth.get_supabase_client")
def test_a_schema_override_neither_reads_nor_writes_the_cache(mock_client, _override):
    """DevSchemaMiddleware binds the whole request to another schema, so a
    cached `public` profile must never answer a `propos_test` request."""
    get_user = _gotrue(mock_client)

    verify_token("token-a")
    verify_token("token-a")

    assert get_user.call_count == 2
    assert auth_cache.get_token("token-a") is None


# ── the monotonic-epoch trap ──────────────────────────────────────────────────


def test_an_absent_key_is_stale_during_a_process_first_seconds():
    """`time.monotonic()`'s epoch is arbitrary — system uptime on Linux — so a
    `0.0` default reads as FRESH for the first minute of every fresh Cloud Run
    container and every CI runner. This is the test that would have caught the
    same bug in `agent/budget.py`."""
    with patch.object(auth_cache, "_now", lambda: 5.0):
        assert auth_cache.get_token("never-seen") is None
        assert auth_cache.get_profile("never-seen") is None


# ── bookkeeping ───────────────────────────────────────────────────────────────


def test_eviction_keeps_the_cache_bounded():
    for i in range(auth_cache._TOKEN_CACHE_MAX + 50):
        auth_cache.put_token(f"token-{i}", {"id": i})

    assert len(auth_cache._token_cache) <= auth_cache._TOKEN_CACHE_MAX


def test_reset_empties_both_caches():
    auth_cache.put_token("token-a", {"id": 1})
    auth_cache.put_profile(USER_ID, {"id": USER_ID})

    auth_cache.reset_auth_caches()

    assert auth_cache.get_token("token-a") is None
    assert auth_cache.get_profile(USER_ID) is None
