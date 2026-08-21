"""The `profiles` snapshot has to be maintained where memberships are written.

`resolve_active_tenant` used to rewrite the snapshot on every request, which
accidentally propagated role edits and revocations within one request. Removing
that write is the whole point of the change — so the propagation has to become
deliberate, and these tests are what say it is.
"""

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from app.features.memberships.service import MembershipService

USER_ID = UUID("11111111-1111-1111-1111-111111111111")
TENANT_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
TENANT_B = "b1b2c3d4-e5f6-7890-abcd-ef1234567890"


class _Recorder:
    """Minimal PostgREST double that records the writes it was asked to make.

    A MagicMock chain cannot tell `profiles` apart from `tenant_memberships`,
    and every assertion here is about which of the two got written.
    """

    def __init__(self, snapshot_tenant: str, memberships: list[dict]):
        self._snapshot_tenant = snapshot_tenant
        self._memberships = memberships
        self.profile_writes: list[dict] = []
        self.membership_writes: list[dict] = []

    def table(self, name: str):
        return _Builder(self, name)


class _Builder:
    def __init__(self, rec: _Recorder, table: str):
        self._rec = rec
        self._table = table
        self._op = "select"
        self._payload: dict | None = None

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def update(self, payload: dict):
        self._op = "update"
        self._payload = payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def execute(self):
        if self._op == "update":
            if self._table == "profiles":
                self._rec.profile_writes.append(self._payload or {})
            else:
                self._rec.membership_writes.append(self._payload or {})
            return MagicMock(data=[self._payload])
        if self._table == "profiles":
            return MagicMock(data={"tenant_id": self._rec._snapshot_tenant})
        return MagicMock(data=list(self._rec._memberships))


def _membership(tenant: str, role: str = "AGENT", scope: list[str] | None = None) -> dict:
    return {"tenant_id": tenant, "role": role, "admin_scope": scope or []}


@pytest.mark.anyio
@patch("app.features.memberships.service.get_supabase_client")
async def test_update_mirrors_role_into_the_active_snapshot(mock_client):
    rec = _Recorder(TENANT_A, [_membership(TENANT_A, "ADMIN", ["crm"])])
    mock_client.return_value = rec

    await MembershipService.update(USER_ID, UUID(TENANT_A), {"role": "ADMIN"})

    assert rec.profile_writes == [{"tenant_id": TENANT_A, "role": "ADMIN", "admin_scope": ["crm"]}]


@pytest.mark.anyio
@patch("app.features.memberships.service.get_supabase_client")
async def test_update_of_a_non_active_tenant_leaves_the_snapshot_alone(mock_client):
    """Editing tenant B must not repoint a snapshot that lives on tenant A."""
    rec = _Recorder(TENANT_A, [_membership(TENANT_A, "ADMIN"), _membership(TENANT_B, "AGENT")])
    mock_client.return_value = rec

    await MembershipService.update(USER_ID, UUID(TENANT_B), {"role": "AGENT"})

    assert rec.profile_writes == [{"tenant_id": TENANT_A, "role": "ADMIN", "admin_scope": []}]


@pytest.mark.anyio
@patch("app.features.memberships.service.get_supabase_client")
async def test_deactivating_the_active_membership_repoints_to_the_next_one(mock_client):
    # is_active=False means the row no longer comes back from the memberships
    # read, so only tenant B survives.
    rec = _Recorder(TENANT_A, [_membership(TENANT_B, "AGENT", ["inbox"])])
    mock_client.return_value = rec

    await MembershipService.update(USER_ID, UUID(TENANT_A), {"is_active": False})

    assert rec.profile_writes == [{"tenant_id": TENANT_B, "role": "AGENT", "admin_scope": ["inbox"]}]


@pytest.mark.anyio
@patch("app.features.memberships.service.get_supabase_client")
async def test_losing_the_last_membership_deactivates_the_profile(mock_client):
    """`profiles.tenant_id` is NOT NULL, so the stale snapshot cannot be
    un-pointed. Deactivating is what makes it inert — `get_current_user` reads
    the flag."""
    rec = _Recorder(TENANT_A, [])
    mock_client.return_value = rec

    await MembershipService.delete(USER_ID, UUID(TENANT_A))

    assert rec.profile_writes == [{"is_active": False}]


@pytest.mark.anyio
@patch("app.features.memberships.service.get_supabase_client")
async def test_delete_repoints_so_the_stale_header_stops_matching(mock_client):
    """The end-to-end revocation story: delete repoints the snapshot to B, so a
    request still carrying `X-Tenant-Id: A` no longer matches and falls through
    to the membership check in resolve_active_tenant, which 403s."""
    rec = _Recorder(TENANT_A, [_membership(TENANT_B)])
    mock_client.return_value = rec

    await MembershipService.delete(USER_ID, UUID(TENANT_A))

    assert rec.profile_writes[-1]["tenant_id"] == TENANT_B
