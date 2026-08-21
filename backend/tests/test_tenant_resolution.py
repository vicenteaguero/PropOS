"""Tests for `resolve_active_tenant`.

This module had no tests at all, which is how a dead guard survived: the branch
`if requested is None and target == current_snapshot` could never be taken in
production (the frontend always sends X-Tenant-Id) and never be taken in tests
either (no test sends the header), so the entire slow path ran on every real
request while every test took the fast one.

The first test below is the whole point of the change: when the header names
the tenant the snapshot already points at, the resolver must not touch the
database.
"""

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.core.tenant import resolve_active_tenant

USER_ID = "11111111-1111-1111-1111-111111111111"
TENANT_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
TENANT_B = "b1b2c3d4-e5f6-7890-abcd-ef1234567890"


def _request(header: str | None = None) -> MagicMock:
    request = MagicMock()
    request.headers = {"x-tenant-id": header} if header else {}
    request.state = MagicMock()
    return request


def _user(tenant_id: str | None = TENANT_A) -> dict:
    return {"id": USER_ID, "role": "ADMIN", "tenant_id": tenant_id}


@patch("app.core.tenant.get_supabase_client")
def test_header_matching_snapshot_touches_nothing(mock_client):
    """The hot path: no membership read, no profile write, no network at all."""
    result = resolve_active_tenant(_request(TENANT_A), _user())

    assert result == UUID(TENANT_A)
    mock_client.return_value.table.assert_not_called()


@patch("app.core.tenant.get_supabase_client")
def test_no_header_with_snapshot_touches_nothing(mock_client):
    resolve_active_tenant(_request(), _user())

    mock_client.return_value.table.assert_not_called()


@patch("app.core.tenant.get_supabase_client")
def test_header_naming_another_tenant_validates_and_writes(mock_client):
    table = MagicMock()
    table.select.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[{"role": "AGENT", "admin_scope": ["crm"]}])
    mock_client.return_value.table.return_value = table

    result = resolve_active_tenant(_request(TENANT_B), _user())

    assert result == UUID(TENANT_B)
    table.update.assert_called_once()
    written = table.update.call_args[0][0]
    assert written["tenant_id"] == TENANT_B
    assert written["role"] == "AGENT"
    assert written["admin_scope"] == ["crm"]


@patch("app.core.tenant.get_supabase_client")
def test_header_without_active_membership_is_forbidden(mock_client):
    """The revocation path: a snapshot repointed by _sync_profile_snapshot makes
    the stale header mismatch, and this is where it gets rejected."""
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[])
    mock_client.return_value.table.return_value = table

    with pytest.raises(HTTPException) as exc:
        resolve_active_tenant(_request(TENANT_B), _user())

    assert exc.value.status_code == 403
    table.update.assert_not_called()


@patch("app.core.tenant.get_supabase_client")
def test_malformed_header_is_rejected(mock_client):
    with pytest.raises(HTTPException) as exc:
        resolve_active_tenant(_request("not-a-uuid"), _user())

    assert exc.value.status_code == 400
    mock_client.return_value.table.assert_not_called()


@patch("app.core.tenant.get_supabase_client")
def test_no_snapshot_falls_back_to_first_membership(mock_client):
    table = MagicMock()
    table.select.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.limit.return_value = table
    table.execute.side_effect = [
        MagicMock(data=[{"tenant_id": TENANT_A}]),  # _default_tenant
        MagicMock(data=[{"role": "ADMIN", "admin_scope": []}]),  # _validate_membership
        MagicMock(data=[]),  # profiles update
    ]
    mock_client.return_value.table.return_value = table

    result = resolve_active_tenant(_request(), _user(tenant_id=None))

    assert result == UUID(TENANT_A)


@patch("app.core.tenant.get_supabase_client")
def test_no_snapshot_and_no_membership_is_forbidden(mock_client):
    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.order.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(data=[])
    mock_client.return_value.table.return_value = table

    with pytest.raises(HTTPException) as exc:
        resolve_active_tenant(_request(), _user(tenant_id=None))

    assert exc.value.status_code == 403
