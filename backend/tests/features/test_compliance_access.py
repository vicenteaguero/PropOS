"""Role gating on the /compliance consent routes (audit R3, P2-03).

Consent is what unblocks outbound WhatsApp/email in the dispatcher, and the
grant route fills the evidence record from the caller's own IP/UA. Ungated, any
authenticated user could manufacture consent for any contact or revoke it in
bulk. The sibling /admin/compliance router was already ADMIN-only.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"
CONTACT_ID = "22222222-2222-2222-2222-222222222222"

ROUTES = [
    ("post", f"/api/v1/compliance/contacts/{CONTACT_ID}/consent"),
    ("delete", f"/api/v1/compliance/contacts/{CONTACT_ID}/consent"),
]


def _client(role: str) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_ID,
        "role": role,
        "tenant_id": TENANT_ID,
        "full_name": f"Test {role}",
        "admin_scope": [],
        "is_dev_admin": False,
        "view": "agent",
    }
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["BUYER", "LANDOWNER", "CONTENT"])
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_non_staff_roles_blocked(role, method, path):
    async with _client(role) as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["BUYER", "LANDOWNER", "AGENT"])
async def test_admin_export_stays_admin_only(role):
    async with _client(role) as client:
        resp = await client.get(f"/api/v1/admin/compliance/contacts/{CONTACT_ID}/export")
    assert resp.status_code == 403
