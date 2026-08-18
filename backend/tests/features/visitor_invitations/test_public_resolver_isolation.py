"""Tenant isolation on the public invitation resolver (audit R3, P1-04).

`GET /v1/public/visitor-invitations/{slug}` takes no JWT. It used to answer with
two things it had no business knowing: the `full_name` / `rut` / `phone` /
`address` of a contact belonging to *another* tenant that happened to share the
invited email, and a global `auth.admin.list_users()` sweep that enumerated
every account in the project. These tests pin both closed.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.features.visitor_invitations.service import VisitorInvitationService

TENANT = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
PROPERTY_ID = "22222222-2222-2222-2222-222222222222"


class RecordingTable:
    """Chainable Supabase stub that records the filters each query applied."""

    def __init__(self, name: str, scripts: dict[str, Any], log: list[dict]):
        self.name = name
        self.scripts = scripts
        self.log = log
        self.filters: list[tuple[str, tuple]] = []

    def _record(self, op: str):
        def apply(*args, **_kwargs):
            self.filters.append((op, args))
            return self

        return apply

    def __getattr__(self, item: str):
        # Any chainable Supabase verb records itself and returns self.
        if item in {
            "select",
            "insert",
            "update",
            "delete",
            "upsert",
            "eq",
            "neq",
            "in_",
            "ilike",
            "or_",
            "is_",
            "contains",
            "limit",
            "order",
            "single",
            "maybe_single",
        }:
            return self._record(item)
        raise AttributeError(item)

    def execute(self):
        self.log.append({"table": self.name, "filters": self.filters})
        result = MagicMock()
        result.data = self.scripts.get(self.name, [])
        return result


class RecordingSupabase:
    def __init__(self, scripts: dict[str, Any]):
        self.scripts = scripts
        self.log: list[dict] = []
        self.auth = MagicMock()
        self.auth.admin = MagicMock()

    def table(self, name: str) -> RecordingTable:
        return RecordingTable(name, self.scripts, self.log)


def _live_invitation() -> dict:
    return {
        "id": "33333333-3333-3333-3333-333333333333",
        "tenant_id": TENANT,
        "slug": "live-slug",
        "email": "Visitor@Example.com",
        "property_id": PROPERTY_ID,
        "mode": "auth",
        "status": "opened",
        "expires_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
    }


def _scripts(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "visitor_invitations": _live_invitation(),
        "properties": {"title": "Casa Las Condes", "address": "Av. Siempre Viva 742"},
        "tenants": {"slug": "corredora"},
        "contacts": [],
        "profiles": [],
    }
    base.update(overrides)
    return base


def _queries(fake: RecordingSupabase, table: str) -> list[dict]:
    return [entry for entry in fake.log if entry["table"] == table]


def _ops(entry: dict) -> set[str]:
    return {op for op, _ in entry["filters"]}


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_contacts_are_only_read_inside_the_invitation_tenant(mock_client):
    """One contacts query, scoped with `eq`; the old `neq` sweep is gone."""
    fake = RecordingSupabase(_scripts())
    mock_client.return_value = fake

    await VisitorInvitationService.resolve_public("live-slug")

    contact_queries = _queries(fake, "contacts")
    assert len(contact_queries) == 1
    assert ("eq", ("tenant_id", TENANT)) in contact_queries[0]["filters"]
    assert "neq" not in _ops(contact_queries[0])


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_no_prefill_when_the_match_lives_in_another_tenant(mock_client):
    """No contact in the invitation's tenant means no prefill at all.

    Paired with the test above — which proves the cross-tenant query is gone —
    this is the outcome that used to leak: previously the fallback query found a
    stranger's row and handed an anonymous caller their RUT and address.
    """
    fake = RecordingSupabase(_scripts(contacts=[]))
    mock_client.return_value = fake

    view = await VisitorInvitationService.resolve_public("live-slug")

    assert view.prefilled is None
    assert view.existing_in_this_tenant is False


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_prefill_still_works_inside_the_tenant(mock_client):
    fake = RecordingSupabase(
        _scripts(
            contacts=[
                {
                    "id": "44444444-4444-4444-4444-444444444444",
                    "full_name": "Ana Pérez",
                    "rut": "11111111-1",
                    "phone": "+56911111111",
                    "address": "Calle Uno 1",
                }
            ]
        )
    )
    mock_client.return_value = fake

    view = await VisitorInvitationService.resolve_public("live-slug")

    assert view.existing_in_this_tenant is True
    assert view.prefilled is not None
    assert view.prefilled.full_name == "Ana Pérez"


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_account_check_is_a_targeted_profiles_lookup(mock_client):
    """No `list_users()` enumeration — one indexed `profiles` read instead."""
    fake = RecordingSupabase(_scripts(profiles=[{"id": "55555555-5555-5555-5555-555555555555"}]))
    mock_client.return_value = fake

    view = await VisitorInvitationService.resolve_public("live-slug")

    assert view.existing_account is True
    fake.auth.admin.list_users.assert_not_called()
    profile_queries = _queries(fake, "profiles")
    assert len(profile_queries) == 1
    # Email is matched case-insensitively against the unique lower(email) index.
    assert ("ilike", ("email", "visitor@example.com")) in profile_queries[0]["filters"]


@pytest.mark.asyncio
@patch("app.features.visitor_invitations.service.get_supabase_client")
async def test_preflight_no_longer_enumerates_accounts(mock_client):
    fake = RecordingSupabase(_scripts(tenant_memberships=[{"tenant_id": TENANT}]))
    mock_client.return_value = fake

    result = await VisitorInvitationService.preflight(
        email="Visitor@Example.com",
        rut=None,
        admin_user_id="11111111-1111-1111-1111-111111111111",
        active_tenant_id=TENANT,
    )

    assert result.auth_user_exists is False
    fake.auth.admin.list_users.assert_not_called()
