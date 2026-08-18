"""The Dueño's "Visitas" tab (audit R3, P2-12 / N4).

`owner-property-detail-page.tsx` reads `GET /v1/interactions?property_id=…&kind=VISIT`.
That router is ADMIN/AGENT-only, so the tab answered 403 and the only screen the
LANDOWNER role has was half broken. The listing now also serves a landowner —
narrowed to its granted properties, and to the interactions the broker actually
shared with the `owner` audience.
"""

from __future__ import annotations

from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.features.grants.access import assert_property_granted
from app.features.interactions.schemas import OwnerVisitResponse, shared_with_owner
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"
GRANTED_PROPERTY = "22222222-2222-2222-2222-222222222222"
FOREIGN_PROPERTY = "33333333-3333-3333-3333-333333333333"
VISIT_ID = "44444444-4444-4444-4444-444444444444"


def _user(role: str) -> dict:
    return {
        "id": USER_ID,
        "role": role,
        "tenant_id": TENANT_ID,
        "full_name": f"Test {role}",
        "admin_scope": [],
        "is_dev_admin": False,
        "view": "owner" if role == "LANDOWNER" else "agent",
    }


def _client(role: str) -> AsyncClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: _user(role)
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _visit(**overrides) -> dict:
    row = {
        "id": VISIT_ID,
        "kind": "VISIT",
        "occurred_at": "2026-07-01T15:00:00+00:00",
        "duration_minutes": 30,
        "summary": "Visita de Juan Soto, +56 9 1234 5678",
        "body": "Notas internas que el dueño nunca debe ver",
        "created_by": USER_ID,
        "audience_caps": {"owner": ["view"]},
        "interaction_participants": [{"person_id": "55555555-5555-5555-5555-555555555555"}],
    }
    row.update(overrides)
    return row


# ---------------------------------------------------------------- routing


@pytest.mark.asyncio
async def test_landowner_reaches_the_listing():
    """Not a 403 any more — the tab's request gets past authorization."""
    with (
        patch(
            "app.features.grants.access.granted_property_ids",
            return_value={GRANTED_PROPERTY},
        ),
        patch(
            "app.features.interactions.router.InteractionService.list_interactions",
            return_value=[_visit()],
        ),
    ):
        async with _client("LANDOWNER") as client:
            resp = await client.get(f"/api/v1/interactions?property_id={GRANTED_PROPERTY}&kind=VISIT")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_landowner_cannot_read_a_property_it_was_not_granted():
    with patch(
        "app.features.grants.access.granted_property_ids",
        return_value={GRANTED_PROPERTY},
    ):
        async with _client("LANDOWNER") as client:
            resp = await client.get(f"/api/v1/interactions?property_id={FOREIGN_PROPERTY}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_landowner_cannot_list_the_whole_tenant():
    """No `property_id` would mean every interaction in the brokerage."""
    async with _client("LANDOWNER") as client:
        resp = await client.get("/api/v1/interactions")
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["BUYER", "CONTENT"])
async def test_other_external_roles_stay_out(role):
    async with _client(role) as client:
        resp = await client.get(f"/api/v1/interactions?property_id={GRANTED_PROPERTY}")
    assert resp.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/v1/interactions"),
        ("get", f"/api/v1/interactions/{VISIT_ID}"),
        ("patch", f"/api/v1/interactions/{VISIT_ID}"),
        ("delete", f"/api/v1/interactions/{VISIT_ID}"),
    ],
)
async def test_landowner_gets_read_only_listing_and_nothing_else(method, path):
    async with _client("LANDOWNER") as client:
        resp = await getattr(client, method)(path)
    assert resp.status_code == 403


# ---------------------------------------------------------------- projection


def test_unshared_interactions_are_dropped():
    assert shared_with_owner(_visit()) is True
    assert shared_with_owner(_visit(audience_caps={})) is False
    assert shared_with_owner(_visit(audience_caps={"agent": ["view"]})) is False


def test_summary_is_withheld_without_the_identity_cap():
    """The summary names the visitor, so it travels only when shared."""
    view = OwnerVisitResponse.from_row(_visit())
    assert view.summary is None

    shared = OwnerVisitResponse.from_row(_visit(audience_caps={"owner": ["view", "view_visitor_identity"]}))
    assert shared.summary == "Visita de Juan Soto, +56 9 1234 5678"


def test_projection_drops_internal_fields():
    fields = set(OwnerVisitResponse.model_fields)
    assert "body" not in fields
    assert "created_by" not in fields
    assert "participants" not in fields
    assert "tenant_id" not in fields


@pytest.mark.asyncio
async def test_owner_payload_only_carries_shared_rows():
    rows = [
        _visit(id=VISIT_ID, audience_caps={"owner": ["view"]}),
        _visit(id="66666666-6666-6666-6666-666666666666", audience_caps={}),
    ]
    with (
        patch(
            "app.features.grants.access.granted_property_ids",
            return_value={GRANTED_PROPERTY},
        ),
        patch(
            "app.features.interactions.router.InteractionService.list_interactions",
            return_value=rows,
        ),
    ):
        async with _client("LANDOWNER") as client:
            resp = await client.get(f"/api/v1/interactions?property_id={GRANTED_PROPERTY}")

    body = resp.json()
    assert [item["id"] for item in body] == [VISIT_ID]
    assert body[0]["summary"] is None
    assert "body" not in body[0]


# ---------------------------------------------------------------- helper


def test_staff_are_never_grant_filtered():
    """`assert_property_granted` is a no-op for internal roles."""
    for role in ("ADMIN", "AGENT", "CONTENT"):
        assert_property_granted(_user(role), UUID(TENANT_ID), None)

    with pytest.raises(HTTPException) as exc:
        assert_property_granted(_user("LANDOWNER"), UUID(TENANT_ID), None)
    assert exc.value.status_code == 403
