"""Tenant scoping in the text-to-SQL guard.

The guard never required a tenant predicate: isolation on this path was a
sentence in a Spanish prompt asking the model to filter by `tenant_id`. These
tests pin the enforcement, plus the strict table allowlist that replaces the
`pg_*` / `information_schema` denylist.

Complements `tests/test_sql_guard.py`, which covers the DML/DDL matrix.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.features.agent.tools.sql_guard import EXPOSED_TABLES, GuardError, validate_and_normalize

TENANT = uuid4()
OTHER_TENANT = uuid4()


def _guard(sql: str) -> str:
    return validate_and_normalize(sql, tenant_id=TENANT)


# ── accepted ─────────────────────────────────────────────────────────

ACCEPTED = [
    ("single-table", f"SELECT id FROM properties WHERE tenant_id = '{TENANT}'"),
    ("qualified", f"SELECT p.id FROM properties p WHERE p.tenant_id = '{TENANT}'"),
    ("cast", f"SELECT id FROM properties WHERE tenant_id = '{TENANT}'::uuid"),
    ("reversed-operands", f"SELECT id FROM properties WHERE '{TENANT}' = tenant_id"),
    (
        "join-both-sides",
        f"SELECT i.id FROM interactions i JOIN contacts c ON c.id = i.created_by "
        f"WHERE i.tenant_id = '{TENANT}' AND c.tenant_id = '{TENANT}'",
    ),
    (
        "predicate-in-the-on-clause",
        f"SELECT i.id FROM interactions i JOIN contacts c ON c.tenant_id = '{TENANT}' WHERE i.tenant_id = '{TENANT}'",
    ),
    (
        "subquery",
        f"SELECT id FROM properties WHERE tenant_id = '{TENANT}' AND id IN "
        f"(SELECT property_id FROM interaction_targets t WHERE t.tenant_id = '{TENANT}')",
    ),
    (
        "cte",
        f"WITH recientes AS (SELECT id FROM interactions i WHERE i.tenant_id = '{TENANT}') SELECT * FROM recientes",
    ),
]


@pytest.mark.parametrize("sql", [s for _, s in ACCEPTED], ids=[i for i, _ in ACCEPTED])
def test_properly_scoped_queries_pass(sql: str) -> None:
    assert _guard(sql)


# ── rejected ─────────────────────────────────────────────────────────

REJECTED = [
    ("no-predicate", "SELECT id FROM properties"),
    ("wrong-tenant", f"SELECT id FROM properties WHERE tenant_id = '{OTHER_TENANT}'"),
    (
        "join-second-table-unscoped",
        f"SELECT i.id FROM interactions i JOIN contacts c ON c.id = i.created_by WHERE i.tenant_id = '{TENANT}'",
    ),
    (
        "join-tenant-chained-instead-of-pinned",
        f"SELECT i.id FROM interactions i JOIN contacts c ON c.tenant_id = i.tenant_id WHERE i.tenant_id = '{TENANT}'",
    ),
    (
        "unqualified-predicate-with-two-tables",
        f"SELECT i.id FROM interactions i, contacts c WHERE tenant_id = '{TENANT}'",
    ),
    (
        "subquery-unscoped",
        f"SELECT id FROM properties WHERE tenant_id = '{TENANT}' "
        f"AND id IN (SELECT property_id FROM interaction_targets)",
    ),
    ("unexposed-table", f"SELECT id FROM profiles WHERE tenant_id = '{TENANT}'"),
    ("unexposed-audit-table", f"SELECT * FROM audit_log WHERE tenant_id = '{TENANT}'"),
    ("qualified-information-schema", "SELECT table_name FROM information_schema.columns"),
    ("non-public-schema", f"SELECT id FROM auth.properties WHERE tenant_id = '{TENANT}'"),
]


@pytest.mark.parametrize("sql", [s for _, s in REJECTED], ids=[i for i, _ in REJECTED])
def test_unscoped_or_unexposed_queries_are_rejected(sql: str) -> None:
    with pytest.raises(GuardError):
        _guard(sql)


def test_cte_name_is_not_mistaken_for_an_unexposed_table() -> None:
    sql = f"WITH por_mes AS (SELECT id FROM transactions t WHERE t.tenant_id = '{TENANT}') SELECT count(*) FROM por_mes"
    assert _guard(sql)


def test_omitting_the_tenant_leaves_the_parse_level_checks_only() -> None:
    """Back-compat: the parse/DML matrix drives the guard without a tenant."""
    assert validate_and_normalize("SELECT id FROM properties")
    with pytest.raises(GuardError):
        validate_and_normalize("DELETE FROM properties")


def test_exposed_tables_matches_the_prompt_schema_list() -> None:
    from app.features.agent.tools.text_to_sql import _EXPOSED_TABLES

    assert set(_EXPOSED_TABLES) == set(EXPOSED_TABLES)
