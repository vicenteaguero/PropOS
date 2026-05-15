"""Integration tests for multi-tenancy + grants + audience_caps RLS helpers.

These assert SQL-level behavior of:
  - get_my_tenant_id() override via session var
  - user_has_property_cap()
  - audience_can()

Requires live Supabase DB + .env credentials (same as `make migrate`).
Run with: poetry run pytest -m integration tests/integration/test_rls_helpers.py
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import psycopg
import pytest

from scripts.db_query import _conn_kwargs

pytestmark = pytest.mark.integration


def _has_db() -> bool:
    try:
        _conn_kwargs()
        return True
    except SystemExit:
        return False


pytestmark = [pytest.mark.integration, pytest.mark.skipif(not _has_db(), reason="DB env missing")]


@pytest.fixture(scope="module")
def conn() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(**_conn_kwargs()) as c:
        yield c


@pytest.fixture
def cur(conn: psycopg.Connection) -> Generator[psycopg.Cursor, None, None]:
    with conn.cursor() as c:
        yield c
        conn.rollback()


def _impersonate(cur: psycopg.Cursor, user_id: str, tenant_id: str | None = None) -> None:
    """Make subsequent SECURITY DEFINER helpers see this auth.uid() + tenant.

    `SET LOCAL` cannot use bound parameters → use set_config() instead.
    """
    cur.execute("SET LOCAL role = authenticated")
    claims = f'{{"sub": "{user_id}", "role": "authenticated"}}'
    cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims,))
    if tenant_id:
        cur.execute("SELECT set_config('app.current_tenant_id', %s, true)", (tenant_id,))


# ---------- get_my_tenant_id ----------

def test_get_my_tenant_id_uses_session_override(cur: psycopg.Cursor) -> None:
    """Session-var override beats profile snapshot fallback."""
    cur.execute("SELECT id, tenant_id FROM profiles WHERE email='vicenteaguero@uc.cl'")
    row = cur.fetchone()
    assert row, "Vicente seed profile missing"
    user_id, real_tenant = row

    # Other tenant the user is also a member of
    cur.execute(
        "SELECT tenant_id FROM tenant_memberships WHERE user_id=%s AND tenant_id<>%s LIMIT 1",
        (user_id, real_tenant),
    )
    other = cur.fetchone()
    if not other:
        pytest.skip("Vicente only has one tenant — cannot test override")
    other_tenant = other[0]

    _impersonate(cur, user_id, str(other_tenant))
    cur.execute("SELECT get_my_tenant_id()")
    assert cur.fetchone()[0] == other_tenant


# ---------- property_grants / user_has_property_cap ----------

def test_owner_has_caps_via_grant(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        SELECT pg.user_id, pg.property_id, pg.tenant_id, pg.capabilities
          FROM property_grants pg
         LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        pytest.skip("No property_grants in DB — seed not run")
    user_id, property_id, tenant_id, caps = row

    _impersonate(cur, str(user_id), str(tenant_id))
    for cap in caps:
        cur.execute("SELECT user_has_property_cap(%s, %s)", (property_id, cap))
        assert cur.fetchone()[0] is True, f"owner should have cap {cap}"

    cur.execute("SELECT user_has_property_cap(%s, %s)", (property_id, "nonexistent_cap"))
    assert cur.fetchone()[0] is False


def test_no_cap_for_user_without_grant(cur: psycopg.Cursor) -> None:
    random_uid = str(uuid.uuid4())
    cur.execute(
        "SELECT property_id FROM property_grants LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        pytest.skip("No property_grants — seed not run")
    property_id = row[0]
    _impersonate(cur, random_uid)
    cur.execute("SELECT user_has_property_cap(%s, %s)", (property_id, "view_documents"))
    assert cur.fetchone()[0] is False


# ---------- audience_can ----------

def test_audience_can_unlocks_for_member_view(cur: psycopg.Cursor) -> None:
    """Owner-view member sees a doc when caps include {'owner': ['view']}."""
    cur.execute(
        """
        SELECT tm.user_id, tm.tenant_id
          FROM tenant_memberships tm
         WHERE tm.view = 'owner'::user_view AND tm.is_active
         LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        pytest.skip("No owner-view membership — seed not run")
    user_id, tenant_id = row

    _impersonate(cur, str(user_id), str(tenant_id))
    cur.execute("SELECT audience_can(%s::jsonb, %s)", ('{"owner":["view"]}', "view"))
    assert cur.fetchone()[0] is True

    cur.execute("SELECT audience_can(%s::jsonb, %s)", ('{"owner":["view"]}', "download"))
    assert cur.fetchone()[0] is False

    cur.execute("SELECT audience_can(%s::jsonb, %s)", ('{"agent":["view"]}', "view"))
    assert cur.fetchone()[0] is False, "owner shouldn't unlock via agent-keyed caps"


def test_audience_can_rejects_empty_caps(cur: psycopg.Cursor) -> None:
    cur.execute(
        "SELECT user_id, tenant_id FROM tenant_memberships WHERE is_active LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        pytest.skip("No memberships — seed not run")
    user_id, tenant_id = row
    _impersonate(cur, str(user_id), str(tenant_id))
    cur.execute("SELECT audience_can('{}'::jsonb, %s)", ("view",))
    assert cur.fetchone()[0] is False


# ---------- activate_tenant ----------

def test_activate_tenant_rejects_non_member(cur: psycopg.Cursor) -> None:
    random_uid = str(uuid.uuid4())
    random_tenant = str(uuid.uuid4())
    _impersonate(cur, random_uid)
    with pytest.raises(psycopg.errors.RaiseException):
        cur.execute("SELECT activate_tenant(%s)", (random_tenant,))


# Note: marker registration handled by pytest.ini / pyproject. If unknown
# warning, add 'integration: hits real Supabase DB' to pytest markers.
