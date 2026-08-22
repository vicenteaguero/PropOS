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


def test_public_share_routes_carry_no_auth_gate():
    """`/r/{slug}` and `/p/{slug}` are anonymous by design.

    They live on `public_router`, which `main.py` mounts separately, so the gate
    added to the documents router must not reach them. They do carry rate limits
    (see `core/rate_limit.py`) — that is abuse control, not authorization.
    """
    public_paths = {"/r/{slug}", "/r/{slug}/verify-password", "/p/{slug}", "/p/{slug}/upload"}
    found = {
        route.path: route.dependencies for route in create_app().routes if getattr(route, "path", None) in public_paths
    }
    assert set(found) == public_paths
    for path, deps in found.items():
        names = {getattr(dep.dependency, "__qualname__", "").split(".")[0] for dep in deps}
        assert names <= {"rate_limit"}, path


# --------------------------------------------------------------------------
# Response-model completeness.
#
# A FastAPI response model silently drops any key it does not declare, so a
# column added to the table and hydrated by the service still arrives as
# undefined on the client with nothing failing anywhere. That is exactly how
# `location` went missing from the calendar feed, so the columns the documents
# list now sorts and groups by get pinned here.
# --------------------------------------------------------------------------


def test_document_response_carries_priority_and_last_opened() -> None:
    from datetime import UTC, datetime
    from uuid import uuid4

    from app.features.documents.schemas import DocumentResponse

    now = datetime.now(UTC)
    dumped = DocumentResponse(
        id=uuid4(),
        tenant_id=uuid4(),
        display_name="Mandato",
        sort_order=0,
        is_priority=True,
        last_opened_at=now,
        created_at=now,
        updated_at=now,
    ).model_dump()
    assert dumped["is_priority"] is True
    assert dumped["last_opened_at"] == now


def test_assignment_response_carries_the_resolved_label() -> None:
    from datetime import UTC, datetime
    from uuid import uuid4

    from app.features.documents.schemas import AssignmentResponse

    dumped = AssignmentResponse(
        id=uuid4(),
        document_id=uuid4(),
        target_kind="PROPERTY",
        property_id=uuid4(),
        label="Depto Macul 1234",
        created_at=datetime.now(UTC),
    ).model_dump()
    assert dumped["label"] == "Depto Macul 1234"
