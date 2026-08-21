"""Signed storage URLs have to be stable enough to be cached by the client.

Supabase puts a token in the URL, so signing the same object twice yields two
different strings — and a different string is a cache miss for the browser and
for the service worker's CacheFirst rule alike. Every property photo was
therefore re-downloaded on every load of the list, even though the bytes had not
changed.

These tests pin the two halves of the fix: the second call reuses the first
URL, and a caller that asks for a non-default lifetime still gets one.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.features.properties import photos

PATH_A = "tenant/prop-1/cover.webp"
PATH_B = "tenant/prop-2/cover.webp"


@pytest.fixture(autouse=True)
def _clean():
    photos.reset_url_cache()
    yield
    photos.reset_url_cache()


def _storage(mock_client) -> MagicMock:
    return mock_client.return_value.storage.from_.return_value


@patch("app.features.properties.photos.get_supabase_client")
def test_the_same_object_gets_the_same_url_twice(mock_client):
    _storage(mock_client).create_signed_url.return_value = {"signedURL": "https://x/signed?token=1"}

    first = photos.signed_url(PATH_A)
    second = photos.signed_url(PATH_A)

    assert first == second
    _storage(mock_client).create_signed_url.assert_called_once()


@patch("app.features.properties.photos.get_supabase_client")
def test_a_shorter_lifetime_is_never_served_from_cache(mock_client):
    """A caller asking for a 60-second URL wants a 60-second URL. Handing back a
    cached 50-minute one would silently ignore the request."""
    _storage(mock_client).create_signed_url.return_value = {"signedURL": "https://x/signed?token=1"}

    photos.signed_url(PATH_A, expires_in=60)
    photos.signed_url(PATH_A, expires_in=60)

    assert _storage(mock_client).create_signed_url.call_count == 2


@patch("app.features.properties.photos.get_supabase_client")
def test_a_batch_only_signs_what_is_not_already_known(mock_client):
    storage = _storage(mock_client)
    storage.create_signed_urls.return_value = [{"path": PATH_A, "signedURL": "https://x/a?token=1"}]

    photos.sign_many([PATH_A])
    storage.create_signed_urls.reset_mock()
    storage.create_signed_urls.return_value = [{"path": PATH_B, "signedURL": "https://x/b?token=1"}]

    out = photos.sign_many([PATH_A, PATH_B])

    # Only the miss is re-signed, and the hit keeps its original URL — which is
    # the whole point: a changed string defeats the client cache.
    storage.create_signed_urls.assert_called_once_with([PATH_B], photos.DEFAULT_SIGNED_URL_TTL)
    assert out[PATH_A] == "https://x/a?token=1"


@patch("app.features.properties.photos.get_supabase_client")
def test_a_batch_that_is_entirely_cached_makes_no_request(mock_client):
    storage = _storage(mock_client)
    storage.create_signed_urls.return_value = [{"path": PATH_A, "signedURL": "https://x/a?token=1"}]

    photos.sign_many([PATH_A])
    storage.create_signed_urls.reset_mock()

    assert photos.sign_many([PATH_A]) == {PATH_A: "https://x/a?token=1"}
    storage.create_signed_urls.assert_not_called()


@patch("app.features.properties.photos.get_supabase_client")
def test_a_failed_batch_still_returns_what_was_cached(mock_client):
    """A page of stale-but-working images beats a page of broken ones."""
    storage = _storage(mock_client)
    storage.create_signed_urls.return_value = [{"path": PATH_A, "signedURL": "https://x/a?token=1"}]
    photos.sign_many([PATH_A])

    storage.create_signed_urls.side_effect = RuntimeError("storage down")
    out = photos.sign_many([PATH_A, PATH_B])

    assert out == {PATH_A: "https://x/a?token=1"}


def test_the_cache_stays_bounded():
    photos._remember_urls({f"path-{i}": f"https://x/{i}" for i in range(photos._URL_CACHE_MAX + 100)})

    assert len(photos._url_cache) <= photos._URL_CACHE_MAX
