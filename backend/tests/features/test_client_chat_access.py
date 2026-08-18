"""Role gating on the /client-chat router (audit R3, P1-06).

The B2C inbox sends through the brokerage's own WhatsApp number. Left ungated
it let any authenticated member of the tenant — including the external BUYER
and LANDOWNER roles — read every client conversation, impersonate the broker on
outbound messages and forge or revoke `client_consents`.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"
CONVERSATION_ID = "22222222-2222-2222-2222-222222222222"
CONTACT_ID = "33333333-3333-3333-3333-333333333333"

ROUTES = [
    ("get", "/api/v1/client-chat/conversations"),
    ("get", f"/api/v1/client-chat/conversations/{CONVERSATION_ID}/messages"),
    ("post", f"/api/v1/client-chat/conversations/{CONVERSATION_ID}/send"),
    ("patch", f"/api/v1/client-chat/conversations/{CONVERSATION_ID}"),
    ("post", "/api/v1/client-chat/consents"),
    ("delete", f"/api/v1/client-chat/consents/{CONTACT_ID}"),
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
@pytest.mark.parametrize("role", ["BUYER", "LANDOWNER", "CONTENT"])
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_non_staff_roles_blocked(role, method, path):
    async with _client(role) as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_admin_scoped_away_from_inbox_blocked(method, path):
    async with _client("ADMIN", ["crm"]) as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403
