"""Role gating on the taxonomy / project routers (audit R3, P2-09).

`ads`, `places`, `projects`, `tags`, `taggings`, `uf` and `workflows` shipped
with no role dependency, so any authenticated member of the tenant — including
the external LANDOWNER and BUYER roles — could read them and, worse, delete the
tags and taggings the whole CRM segmentation rests on.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"
ROW_ID = "22222222-2222-2222-2222-222222222222"

EXTERNAL_ROLES = ["BUYER", "LANDOWNER"]

ROUTES = [
    ("get", "/api/v1/ads"),
    ("delete", f"/api/v1/ads/{ROW_ID}"),
    ("get", "/api/v1/places"),
    ("delete", f"/api/v1/places/{ROW_ID}"),
    ("get", "/api/v1/projects"),
    ("delete", f"/api/v1/projects/{ROW_ID}"),
    ("get", "/api/v1/tags"),
    ("delete", f"/api/v1/tags/{ROW_ID}"),
    ("get", "/api/v1/taggings"),
    ("delete", f"/api/v1/taggings/{ROW_ID}"),
    ("get", "/api/v1/uf/today"),
    ("get", "/api/v1/workflows"),
    ("post", "/api/v1/workflows"),
]


def _client(role: str, scope: list[str] | None = None) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_ID,
        "role": role,
        "tenant_id": TENANT_ID,
        "full_name": f"Test {role}",
        "admin_scope": scope or [],
        "is_dev_admin": False,
        "view": "agent",
    }
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.parametrize("role", EXTERNAL_ROLES)
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_external_roles_blocked(role, method, path):
    async with _client(role) as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["BUYER", "LANDOWNER", "CONTENT", "AGENT"])
async def test_uf_refresh_is_admin_only(role):
    """Refresh calls an external API and schedules a backfill — ADMIN only."""
    async with _client(role) as client:
        resp = await client.post("/api/v1/uf/refresh")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_workflows_honours_its_scope():
    async with _client("ADMIN", ["crm"]) as client:
        resp = await client.get("/api/v1/workflows")
    assert resp.status_code == 403
