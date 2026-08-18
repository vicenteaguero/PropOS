"""Cross-tenant row visibility under RLS (R1-#17).

The vehicle matters. `get_supabase_client()` is the service-role key, which is
BYPASSRLS — a test built on it goes green whether the policies are right or
not. So this suite talks to Postgres directly and impersonates the
`authenticated` role the way `test_rls_helpers.py::_impersonate` does:
`SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims'|
'app.current_tenant_id')`, which is exactly what PostgREST does per request.

Every test asserts *both* halves:

  - a tenant must not see another tenant's rows, and
  - a tenant *must* still see its own.

The second half is the one that gets forgotten, and it is the one that catches
a deny-everything policy — which looks like perfect isolation and silently
breaks the feature.

Runs against production (there is only one database), so: seed inside the
transaction, prefix every marker with `_xtest_`, never commit. The `cur`
fixture rolls back after each test.

Run with:
    poetry run pytest tests/integration/test_cross_tenant.py -m integration -v
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from dataclasses import dataclass

import psycopg
import pytest

from scripts.db_query import _conn_kwargs

MARKER_PREFIX = "_xtest_"


def _has_db() -> bool:
    try:
        _conn_kwargs()
        return True
    except SystemExit:
        return False


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _has_db(), reason="DB env missing"),
]


# ── Tables under test ────────────────────────────────────────────────


@dataclass(frozen=True)
class TenantTable:
    """A tenant-scoped table plus the minimum INSERT that satisfies its NOT NULLs.

    `insert` is a named-parameter statement; the fixture always binds
    id / tenant_id / marker / user_id / session_id, so a spec only spends
    literals on the columns that are specific to the table.
    """

    name: str
    insert: str


TENANT_TABLES: list[TenantTable] = [
    TenantTable(
        "properties",
        "INSERT INTO properties (id, tenant_id, title) VALUES (%(id)s, %(tenant_id)s, %(marker)s)",
    ),
    TenantTable(
        "contacts",
        "INSERT INTO contacts (id, tenant_id, full_name) VALUES (%(id)s, %(tenant_id)s, %(marker)s)",
    ),
    TenantTable(
        "documents",
        "INSERT INTO documents (id, tenant_id, display_name, kind, origin) "
        "VALUES (%(id)s, %(tenant_id)s, %(marker)s, 'PDF', 'UPLOAD')",
    ),
    TenantTable(
        "pending_proposals",
        "INSERT INTO pending_proposals (id, tenant_id, agent_session_id, proposed_by_user, kind, payload) "
        "VALUES (%(id)s, %(tenant_id)s, %(session_id)s, %(user_id)s, %(marker)s, '{}'::jsonb)",
    ),
    TenantTable(
        "tasks",
        "INSERT INTO tasks (id, tenant_id, title) VALUES (%(id)s, %(tenant_id)s, %(marker)s)",
    ),
    TenantTable(
        "interactions",
        "INSERT INTO interactions (id, tenant_id, kind, summary) VALUES (%(id)s, %(tenant_id)s, 'NOTE', %(marker)s)",
    ),
]

TABLE_IDS = [t.name for t in TENANT_TABLES]


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def conn() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(**_conn_kwargs()) as c:
        yield c
        c.rollback()


@pytest.fixture
def cur(conn: psycopg.Connection) -> Generator[psycopg.Cursor, None, None]:
    with conn.cursor() as c:
        yield c
        conn.rollback()


@pytest.fixture
def tenant_pair(cur: psycopg.Cursor) -> tuple[str, str]:
    cur.execute("SELECT id FROM tenants ORDER BY created_at, id LIMIT 2")
    rows = cur.fetchall()
    if len(rows) < 2:
        pytest.skip("need two tenants to test isolation")
    return str(rows[0][0]), str(rows[1][0])


@pytest.fixture
def actor_id(cur: psycopg.Cursor) -> str:
    """Any real auth user — needed for the FKs on `pending_proposals`."""
    cur.execute("SELECT id FROM auth.users LIMIT 1")
    row = cur.fetchone()
    if not row:
        pytest.skip("no auth.users rows — seed not run")
    return str(row[0])


# ── Helpers ──────────────────────────────────────────────────────────


def _impersonate(cur: psycopg.Cursor, user_id: str, tenant_id: str) -> None:
    """Become `authenticated` scoped to `tenant_id`, as PostgREST would.

    `SET LOCAL` takes no bound parameters → set_config(). Everything is
    transaction-local, so the fixture's rollback undoes it.
    """
    cur.execute("SET LOCAL role = authenticated")
    cur.execute(
        "SELECT set_config('request.jwt.claims', %s, true)",
        (f'{{"sub": "{user_id}", "role": "authenticated"}}',),
    )
    cur.execute("SELECT set_config('app.current_tenant_id', %s, true)", (tenant_id,))


def _seed(cur: psycopg.Cursor, table: TenantTable, tenant_id: str, actor_id: str) -> tuple[str, str]:
    """Insert one identifiable row for `tenant_id`. Returns (row_id, marker)."""
    row_id = str(uuid.uuid4())
    marker = f"{MARKER_PREFIX}{table.name}_{uuid.uuid4().hex[:8]}"
    cur.execute(
        table.insert,
        {
            "id": row_id,
            "tenant_id": tenant_id,
            "marker": marker,
            "user_id": actor_id,
            "session_id": str(uuid.uuid4()),
        },
    )
    return row_id, marker


def _count_visible(cur: psycopg.Cursor, table: str, row_ids: list[str]) -> int:
    cur.execute(f"SELECT count(*) FROM {table} WHERE id = ANY(%s::uuid[])", (row_ids,))
    return cur.fetchone()[0]


# ── Policy presence: a new table without a policy fails by absence ───


@pytest.mark.parametrize("table", TENANT_TABLES, ids=TABLE_IDS)
def test_table_has_tenant_scoped_policies(cur: psycopg.Cursor, table: TenantTable) -> None:
    """`pg_policies` must show tenant-scoped SELECT + INSERT for `authenticated`."""
    cur.execute(
        """
        SELECT cmd, qual, with_check
          FROM pg_policies
         WHERE schemaname = 'public' AND tablename = %s AND 'authenticated' = ANY(roles)
        """,
        (table.name,),
    )
    policies = cur.fetchall()
    assert policies, f"{table.name} has no RLS policy for role 'authenticated'"

    selects = [p for p in policies if p[0] == "SELECT"]
    assert selects, f"{table.name} has no SELECT policy for 'authenticated'"
    assert any("get_my_tenant_id()" in (p[1] or "") for p in selects), (
        f"{table.name} SELECT policies never reference get_my_tenant_id(): {[p[1] for p in selects]}"
    )

    inserts = [p for p in policies if p[0] == "INSERT"]
    assert inserts, f"{table.name} has no INSERT policy for 'authenticated'"
    assert any("get_my_tenant_id()" in (p[2] or "") for p in inserts), (
        f"{table.name} INSERT policies have no tenant WITH CHECK: {[p[2] for p in inserts]}"
    )


def test_every_tenant_scoped_table_has_rls(cur: psycopg.Cursor) -> None:
    """Sweep: any public table with a `tenant_id` column must have RLS + a policy.

    This is the catch-all — a table added later with a tenant column but no
    policy fails here without anyone remembering to extend TENANT_TABLES.
    """
    cur.execute(
        """
        SELECT c.relname,
               c.relrowsecurity,
               (SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname)
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND EXISTS (
                 SELECT 1 FROM information_schema.columns col
                  WHERE col.table_schema = 'public'
                    AND col.table_name = c.relname
                    AND col.column_name = 'tenant_id')
         ORDER BY c.relname
        """
    )
    rows = cur.fetchall()
    assert rows, "no tenant-scoped tables found — query is wrong"

    without_rls = [r[0] for r in rows if not r[1]]
    without_policy = [r[0] for r in rows if r[2] == 0]
    assert not without_rls, f"tenant-scoped tables with RLS disabled: {without_rls}"
    assert not without_policy, f"tenant-scoped tables with RLS on but no policy: {without_policy}"


# ── Row visibility: the two halves ───────────────────────────────────


@pytest.mark.parametrize("table", TENANT_TABLES, ids=TABLE_IDS)
def test_other_tenant_rows_are_invisible(
    cur: psycopg.Cursor,
    table: TenantTable,
    tenant_pair: tuple[str, str],
    actor_id: str,
) -> None:
    tenant_a, tenant_b = tenant_pair
    b_row, _ = _seed(cur, table, tenant_b, actor_id)

    # Seeded as postgres (BYPASSRLS): confirm the row is really there, so a
    # later count of 0 means "hidden", not "never inserted".
    assert _count_visible(cur, table.name, [b_row]) == 1, f"seed for tenant B did not land in {table.name}"

    _impersonate(cur, actor_id, tenant_a)

    cur.execute(f"SELECT count(*) FROM {table.name} WHERE tenant_id = %s", (tenant_b,))
    assert cur.fetchone()[0] == 0, f"{table.name}: tenant A can count tenant B's rows"
    assert _count_visible(cur, table.name, [b_row]) == 0, f"{table.name}: tenant A can read a tenant B row by id"


@pytest.mark.parametrize("table", TENANT_TABLES, ids=TABLE_IDS)
def test_own_tenant_rows_stay_visible(
    cur: psycopg.Cursor,
    table: TenantTable,
    tenant_pair: tuple[str, str],
    actor_id: str,
) -> None:
    """The half that catches a policy which denies everything."""
    tenant_a, _ = tenant_pair
    a_row, _ = _seed(cur, table, tenant_a, actor_id)

    _impersonate(cur, actor_id, tenant_a)

    cur.execute(f"SELECT count(*) FROM {table.name} WHERE tenant_id = %s", (tenant_a,))
    assert cur.fetchone()[0] > 0, f"{table.name}: tenant A sees none of its own rows — policy denies everything"
    assert _count_visible(cur, table.name, [a_row]) == 1, f"{table.name}: tenant A cannot read the row it just created"


@pytest.mark.parametrize("table", TENANT_TABLES, ids=TABLE_IDS)
def test_both_halves_in_one_query(
    cur: psycopg.Cursor,
    table: TenantTable,
    tenant_pair: tuple[str, str],
    actor_id: str,
) -> None:
    """Two rows in, exactly one out — rules out both leak and blanket denial."""
    tenant_a, tenant_b = tenant_pair
    a_row, _ = _seed(cur, table, tenant_a, actor_id)
    b_row, _ = _seed(cur, table, tenant_b, actor_id)
    assert _count_visible(cur, table.name, [a_row, b_row]) == 2, f"{table.name}: seeds did not land"

    _impersonate(cur, actor_id, tenant_a)

    cur.execute(f"SELECT id FROM {table.name} WHERE id = ANY(%s::uuid[])", ([a_row, b_row],))
    visible = [str(r[0]) for r in cur.fetchall()]
    assert visible == [a_row], f"{table.name}: expected only tenant A's row, got {visible}"


# ── Write path ───────────────────────────────────────────────────────


@pytest.mark.parametrize("table", TENANT_TABLES, ids=TABLE_IDS)
def test_insert_into_other_tenant_is_denied(
    cur: psycopg.Cursor,
    table: TenantTable,
    tenant_pair: tuple[str, str],
    actor_id: str,
) -> None:
    """Writing a row stamped with tenant B from tenant A's context must fail.

    The control insert into tenant A runs first: without it, a table that
    simply lacks INSERT grants would make this test pass for the wrong reason.
    """
    tenant_a, tenant_b = tenant_pair
    _impersonate(cur, actor_id, tenant_a)

    _seed(cur, table, tenant_a, actor_id)  # control: same statement, own tenant

    with pytest.raises(psycopg.errors.InsufficientPrivilege) as exc:
        _seed(cur, table, tenant_b, actor_id)
    assert "row-level security" in str(exc.value).lower(), (
        f"{table.name}: insert was refused, but not by RLS: {exc.value}"
    )
