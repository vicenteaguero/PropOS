"""Unit tests for visitor_invitations service. Mocks Supabase chain end-to-end."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.features.compliance.schemas import ConsentEvidence
from app.features.visitor_invitations.schemas import (
    InvitationCreate,
    SubmitPayload,
)
from app.features.visitor_invitations.service import VisitorInvitationService

TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
OTHER_TENANT = "b2c3d4e5-f6a7-8901-bcde-f23456789012"
ADMIN_USER = "11111111-1111-1111-1111-111111111111"
PROPERTY_ID = "22222222-2222-2222-2222-222222222222"


def _exec(data: Any) -> MagicMock:
    """Build a mock that exposes `.data = data` when `.execute()` is called."""
    m = MagicMock()
    m.data = data
    return m


class FakeTable:
    """Chainable mock that captures table operations and returns scripted data."""

    def __init__(self, name: str, scripts: dict[str, Any]):
        self.name = name
        self.scripts = scripts
        self._last_op: str | None = None

    def _chain(self, *_args, **_kwargs):
        return self

    select = _chain
    insert = _chain
    update = _chain
    delete = _chain
    upsert = _chain
    eq = _chain
    neq = _chain
    in_ = _chain
    ilike = _chain
    or_ = _chain
    is_ = _chain
    contains = _chain
    limit = _chain
    order = _chain
    single = _chain
    maybe_single = _chain

    def execute(self):
        data = self.scripts.get(self.name, [])
        return _exec(data)


class FakeSupabase:
    """Routes `.table(name)` to a FakeTable with named scripted responses."""

    def __init__(self, scripts: dict[str, Any], auth_users: list[Any] | None = None):
        self.scripts = scripts
        self.auth = MagicMock()
        self.auth.admin = MagicMock()
        self.auth.admin.list_users = MagicMock(return_value=auth_users or [])
        self.auth.admin.create_user = MagicMock()
        self.auth.admin.invite_user_by_email = MagicMock()

    def table(self, name: str) -> FakeTable:
        return FakeTable(name, self.scripts)


# ---------------------------------------------------------------- preflight


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_preflight_no_duplicates(mock_client):
    fake = FakeSupabase(
        scripts={
            "tenant_memberships": [{"tenant_id": TENANT}],
            "contacts": [],
            "tenants": [],
        },
        auth_users=[],
    )
    mock_client.return_value = fake

    result = await VisitorInvitationService.preflight(
        email="nuevo@example.com",
        rut=None,
        admin_user_id=UUID(ADMIN_USER),
        active_tenant_id=UUID(TENANT),
    )

    assert result.contact_exists_in_this_tenant is False
    assert result.contact_exists_in_other_tenant is False
    assert result.auth_user_exists is False
    assert result.warnings == []


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_preflight_existing_contact_other_tenant(mock_client):
    fake = FakeSupabase(
        scripts={
            "tenant_memberships": [{"tenant_id": TENANT}, {"tenant_id": OTHER_TENANT}],
            "contacts": [{"id": str(uuid4()), "tenant_id": OTHER_TENANT}],
            "tenants": [{"slug": "ceter"}],
        },
        auth_users=[],
    )
    mock_client.return_value = fake

    result = await VisitorInvitationService.preflight(
        email="dup@example.com",
        rut=None,
        admin_user_id=UUID(ADMIN_USER),
        active_tenant_id=UUID(TENANT),
    )

    assert result.contact_exists_in_other_tenant is True
    assert "ceter" in result.other_tenant_slugs
    assert any("otro tenant" in w for w in result.warnings)


# ---------------------------------------------------------------- create


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.email_service.send_visitor_invitation", new_callable=AsyncMock)
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_create_invitation_inserts_and_emails(mock_client, mock_send):
    now = datetime.now(UTC)
    inserted_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "abc123def456",
        "email": "nuevo@example.com",
        "property_id": PROPERTY_ID,
        "mode": "visitor_only",
        "status": "pending",
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    }
    fake = FakeSupabase(
        scripts={
            "properties": {"id": PROPERTY_ID, "title": "Casa Test"},
            "tenants": {"slug": "ceter", "name": "CETER"},
            "visitor_invitations": [inserted_row],
        }
    )
    mock_client.return_value = fake
    mock_send.return_value = "msg-id-123"

    payload = InvitationCreate(
        email="nuevo@example.com",
        property_id=UUID(PROPERTY_ID),
        mode="visitor_only",
    )
    result = await VisitorInvitationService.create_invitation(
        payload, UUID(TENANT), UUID(ADMIN_USER)
    )

    assert result.email == "nuevo@example.com"
    assert result.status == "pending"
    assert "/invitacion/" in result.invite_url
    mock_send.assert_awaited_once()


# ---------------------------------------------------------------- resolve_public


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_resolve_public_marks_opened(mock_client):
    now = datetime.now(UTC)
    inv_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "live-slug",
        "email": "v@example.com",
        "property_id": PROPERTY_ID,
        "mode": "visitor_only",
        "status": "pending",
        "expires_at": (now + timedelta(days=5)).isoformat(),
        "id_document_id": None,
    }
    fake = FakeSupabase(
        scripts={
            "visitor_invitations": inv_row,
            "properties": {"title": "Casa Test", "address": "Calle 1"},
            "tenants": {"slug": "ceter"},
            "contacts": [],
        },
        auth_users=[],
    )
    mock_client.return_value = fake

    view = await VisitorInvitationService.resolve_public("live-slug")

    assert view.slug == "live-slug"
    assert view.property_title == "Casa Test"
    assert view.existing_account is False


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_resolve_public_expired_410(mock_client):
    now = datetime.now(UTC)
    inv_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "old-slug",
        "email": "v@example.com",
        "property_id": PROPERTY_ID,
        "mode": "visitor_only",
        "status": "pending",
        "expires_at": (now - timedelta(days=1)).isoformat(),
    }
    fake = FakeSupabase(scripts={"visitor_invitations": inv_row})
    mock_client.return_value = fake

    with pytest.raises(HTTPException) as exc:
        await VisitorInvitationService.resolve_public("old-slug")
    assert exc.value.status_code == 410


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_resolve_public_already_completed_410(mock_client):
    inv_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "done-slug",
        "email": "v@example.com",
        "property_id": PROPERTY_ID,
        "mode": "visitor_only",
        "status": "completed",
        "expires_at": (datetime.now(UTC) + timedelta(days=5)).isoformat(),
    }
    fake = FakeSupabase(scripts={"visitor_invitations": inv_row})
    mock_client.return_value = fake

    with pytest.raises(HTTPException) as exc:
        await VisitorInvitationService.resolve_public("done-slug")
    assert exc.value.status_code == 410


# ---------------------------------------------------------------- submit


@pytest.mark.asyncio
@patch(
    "app.features.visitor_invitations.service.ComplianceService.record_consent",
    new_callable=AsyncMock,
)
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_submit_public_creates_contact_and_consent(mock_client, mock_record):
    now = datetime.now(UTC)
    contact_id = str(uuid4())
    inv_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "live-slug",
        "email": "v@example.com",
        "property_id": PROPERTY_ID,
        "mode": "visitor_only",
        "status": "opened",
        "expires_at": (now + timedelta(days=5)).isoformat(),
    }
    fake = FakeSupabase(
        scripts={
            "visitor_invitations": inv_row,
            "contacts": [{"id": contact_id}],
            "interactions": [{"id": str(uuid4())}],
            "interaction_targets": [],
            "interaction_participants": [],
        },
        auth_users=[],
    )
    mock_client.return_value = fake
    mock_record.return_value = {"id": contact_id}

    payload = SubmitPayload(
        full_name="Juan Pérez",
        rut="11.111.111-1",
        phone="+56911111111",
        consent_evidence=ConsentEvidence(
            ip="1.2.3.4", user_agent="ua", text_shown="ok", channel="web"
        ),
    )

    result = await VisitorInvitationService.submit_public(
        "live-slug", payload, request_ip="1.2.3.4", user_agent="ua"
    )

    assert result.contact_id == UUID(contact_id)
    assert result.requires_email_confirmation is False
    mock_record.assert_awaited_once()


@pytest.mark.asyncio
@patch(
    "app.features.visitor_invitations.service.ComplianceService.record_consent",
    new_callable=AsyncMock,
)
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_submit_public_existing_account_path_b(mock_client, mock_record):
    """auth_user mode with pre-existing auth.users entry must NOT create duplicate."""
    now = datetime.now(UTC)
    auth_user_id = str(uuid4())
    contact_id = str(uuid4())
    inv_row = {
        "id": str(uuid4()),
        "tenant_id": TENANT,
        "slug": "auth-slug",
        "email": "existing@example.com",
        "property_id": PROPERTY_ID,
        "mode": "auth_user",
        "status": "opened",
        "expires_at": (now + timedelta(days=5)).isoformat(),
    }
    existing_user = MagicMock()
    existing_user.id = auth_user_id
    existing_user.email = "existing@example.com"

    fake = FakeSupabase(
        scripts={
            "visitor_invitations": inv_row,
            "contacts": [{"id": contact_id}],
            "profiles": None,
            "tenant_memberships": [],
            "interactions": [{"id": str(uuid4())}],
            "interaction_targets": [],
            "interaction_participants": [],
        },
        auth_users=[existing_user],
    )
    mock_client.return_value = fake
    mock_record.return_value = {"id": contact_id}

    payload = SubmitPayload(
        full_name="Ana Existente",
        rut="11.111.111-1",
        password="superseguro123",
        consent_evidence=ConsentEvidence(ip="1.2.3.4", channel="web"),
    )

    result = await VisitorInvitationService.submit_public(
        "auth-slug", payload, request_ip="1.2.3.4", user_agent="ua"
    )

    assert result.user_id == UUID(auth_user_id)
    fake.auth.admin.create_user.assert_not_called()
    mock_record.assert_awaited_once()
