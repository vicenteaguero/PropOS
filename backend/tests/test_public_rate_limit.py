"""Rate limiting on the anonymous surface (audit R3, P3).

`/r/{slug}/verify-password` gated a share link behind a password with nothing
stopping an attacker from trying every value, and the two anonymous upload
routes had no ceiling at all. These tests drive the limiter with a fake clock so
they are deterministic and cost no wall time.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import Depends, FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient

from app.core import rate_limit as rl
from app.main import create_app


@pytest.fixture(autouse=True)
def clean_counters() -> Iterator[None]:
    rl.reset_all()
    yield
    rl.reset_all()


@pytest.fixture
def fake_clock(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[float]]:
    """Replace `time.monotonic`; tests advance time by writing to `now[0]`."""
    now = [1000.0]
    monkeypatch.setattr(rl.time, "monotonic", lambda: now[0])
    yield now


def _request(ip: str = "203.0.113.7", forwarded: str | None = None, **path_params) -> Request:
    headers = []
    if forwarded is not None:
        headers.append((b"x-forwarded-for", forwarded.encode()))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/r/abc",
        "headers": headers,
        "client": (ip, 12345),
        "path_params": path_params,
    }
    return Request(scope)


# ---------------------------------------------------------------- window


@pytest.mark.asyncio
async def test_allows_up_to_the_limit_then_refuses(fake_clock):
    limiter = rl.rate_limit("test_bucket", limit=3, window_seconds=60)
    for _ in range(3):
        await limiter(_request())

    with pytest.raises(HTTPException) as exc:
        await limiter(_request())
    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "60"


@pytest.mark.asyncio
async def test_window_slides(fake_clock):
    limiter = rl.rate_limit("test_slide", limit=2, window_seconds=60)
    await limiter(_request())
    await limiter(_request())
    with pytest.raises(HTTPException):
        await limiter(_request())

    fake_clock[0] += 61
    await limiter(_request())  # window drained, allowed again


@pytest.mark.asyncio
async def test_separate_callers_get_separate_budgets(fake_clock):
    limiter = rl.rate_limit("test_per_ip", limit=1, window_seconds=60)
    await limiter(_request(ip="198.51.100.1"))
    await limiter(_request(ip="198.51.100.2"))

    with pytest.raises(HTTPException):
        await limiter(_request(ip="198.51.100.1"))


@pytest.mark.asyncio
async def test_slug_key_ignores_the_caller(fake_clock):
    """Password guessing is capped per link, so rotating IPs buys nothing."""
    limiter = rl.rate_limit("test_per_slug", limit=2, window_seconds=300, key=rl.by_path_param("slug"))
    await limiter(_request(ip="198.51.100.1", slug="secret-link"))
    await limiter(_request(ip="198.51.100.2", slug="secret-link"))

    with pytest.raises(HTTPException):
        await limiter(_request(ip="198.51.100.3", slug="secret-link"))

    # A different link has its own budget.
    await limiter(_request(ip="198.51.100.3", slug="other-link"))


# ---------------------------------------------------------------- caller identity


def test_forwarded_for_uses_the_hop_the_client_cannot_forge():
    """A client can prepend entries; it cannot remove the one the proxy appends."""
    assert rl.client_ip(_request(forwarded="1.2.3.4, 203.0.113.9")) == "203.0.113.9"


def test_falls_back_to_the_peer_without_the_header():
    assert rl.client_ip(_request(ip="203.0.113.7")) == "203.0.113.7"


def test_spoofed_single_value_header_does_not_split_the_bucket():
    """Only value present, so it is what the proxy wrote — or a direct client."""
    assert rl.client_ip(_request(forwarded="10.0.0.1")) == "10.0.0.1"


# ---------------------------------------------------------------- wiring


PUBLIC_ROUTES = {
    "/r/{slug}",
    "/r/{slug}/verify-password",
    "/p/{slug}",
    "/p/{slug}/upload",
    "/api/v1/public/visitor-invitations/{slug}",
    "/api/v1/public/visitor-invitations/{slug}/upload-id",
    "/api/v1/public/visitor-invitations/{slug}/submit",
}


def test_every_anonymous_route_is_limited():
    limited = {
        route.path
        for route in create_app().routes
        if any(
            getattr(dep.dependency, "__qualname__", "").startswith("rate_limit")
            for dep in getattr(route, "dependencies", [])
        )
    }
    assert PUBLIC_ROUTES <= limited, PUBLIC_ROUTES - limited


@pytest.mark.asyncio
async def test_limiter_answers_429_over_http(fake_clock):
    """End-to-end through ASGI, on a throwaway app so no real service is hit."""
    app = FastAPI()

    @app.get("/probe", dependencies=[Depends(rl.rate_limit("probe", limit=1, window_seconds=60))])
    async def probe() -> dict:
        return {"ok": True}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/probe")).status_code == 200
        second = await client.get("/probe")

    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"
