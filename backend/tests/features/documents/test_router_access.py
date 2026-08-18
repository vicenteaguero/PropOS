"""Role gating on the documents router (audit R3, P1-05).

The router used to carry no role dependency at all, so any authenticated member
of the tenant — including the external LANDOWNER and BUYER roles — could list,
download, delete and publish share links. These tests pin the boundary:
staff-only everywhere, two grant-scoped reads for the owner PWA, and the public
share/portal resolver untouched.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"
DOC_ID = "22222222-2222-2222-2222-222222222222"
VERSION_ID = "33333333-3333-3333-3333-333333333333"

STAFF_ONLY_ROUTES = [
    ("get", f"/api/v1/documents/{DOC_ID}"),
    ("delete", f"/api/v1/documents/{DOC_ID}"),
    ("get", "/api/v1/share-links"),
    ("delete", f"/api/v1/share-links/{DOC_ID}"),
    ("get", "/api/v1/portals"),
    ("get", f"/api/v1/documents/{DOC_ID}/versions/{VERSION_ID}/source-images"),
]

OWNER_READ_ROUTES = [
    "/api/v1/documents",
    f"/api/v1/documents/{DOC_ID}/versions/{VERSION_ID}/download",
]


def _user(role: str, scope: list[str] | None = None) -> dict:
    return {
        "id": USER_ID,
        "role": role,
        "tenant_id": TENANT_ID,
        "full_name": f"Test {role}",
        "admin_scope": scope or [],
        "is_dev_admin": False,
        "view": "agent",
    }


@pytest.fixture
def client_for():
    """Build a client whose authenticated user has the given role/scope."""

    def build(role: str, scope: list[str] | None = None) -> AsyncClient:
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: _user(role, scope)
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    return build


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["BUYER", "LANDOWNER"])
@pytest.mark.parametrize(("method", "path"), STAFF_ONLY_ROUTES)
async def test_external_roles_blocked_from_staff_routes(client_for, role, method, path):
    async with client_for(role) as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("path", OWNER_READ_ROUTES)
async def test_buyer_blocked_from_owner_reads(client_for, path):
    async with client_for("BUYER") as client:
        resp = await client.get(path)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_landowner_cannot_list_whole_catalogue(client_for):
    """No property_id means "everything in the tenant" — refused for a landowner."""
    async with client_for("LANDOWNER") as client:
        resp = await client.get("/api/v1/documents")
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("path", OWNER_READ_ROUTES)
async def test_scope_restricted_admin_blocked(client_for, path):
    """An admin scoped away from `documents` loses the whole router."""
    async with client_for("ADMIN", ["crm"]) as client:
        resp = await client.get(path)
    assert resp.status_code == 403


def test_public_share_routes_stay_ungated():
    """`/r/{slug}` and `/p/{slug}` are anonymous by design.

    They live on `public_router`, which `main.py` mounts separately, so the gate
    added to the documents router must not reach them.
    """
    public_paths = {"/r/{slug}", "/r/{slug}/verify-password", "/p/{slug}", "/p/{slug}/upload"}
    found = {
        route.path: route.dependencies for route in create_app().routes if getattr(route, "path", None) in public_paths
    }
    assert set(found) == public_paths
    assert all(deps == [] for deps in found.values())
