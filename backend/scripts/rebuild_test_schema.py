"""Rebuild the `propos_test` schema as a structural mirror of `public`.

Why this exists
---------------
`supabase/migrations/20240601000002_propos_test_schema.sql` created propos_test
by hand, listing 28 tables. Every migration since then added tables to `public`
only, so the schema the integration suite runs against drifted into a partial,
three-months-stale copy. There is a single Supabase project — `public` IS
production — so the test schema has to be regenerated from the live structure
rather than maintained by hand.

What it does
------------
Drops and recreates `propos_test`, then clones every base table of `public` with
`CREATE TABLE ... (LIKE public.<t> INCLUDING ...)`, then replays every foreign
key so the mirror has the same reference graph. The keys are rebuilt to point
INSIDE the mirror -- never back at production -- while `auth.*` targets are left
alone, since auth is project-level and shared.

Foreign keys used to be skipped. That silently broke PostgREST embeds, which
derive from them: the workspace switcher's `select("*, tenants(...)")` answered
PGRST200 against the mirror and 200 in production.

Safety
------
The only statements that name `public` are `LIKE public.<table>` clauses, which
read a definition. Before anything executes, every statement is checked against
a denylist of write verbs applied to `public`; a single match aborts the run.
Use --dry-run to print the SQL and execute nothing.

Usage:
    poetry run python -m scripts.rebuild_test_schema [--dry-run] [--schema NAME]
"""

from __future__ import annotations

import argparse
import re
import sys

import psycopg
from psycopg import sql

from scripts.db_query import _conn_kwargs

TEST_SCHEMA = "propos_test"

# Roles that must keep working against the mirror. `agent_readonly` is the
# NOBYPASSRLS login used by the agent's text-to-SQL tool; migration ...0002
# still grants to its pre-rename name (`anita_readonly`), which no longer
# exists, so the grant is re-applied here from the current role name.
GRANT_ROLES_ALL = ("service_role",)
# `anon` and `authenticated` are deliberately absent: the mirror is exposed
# through PostgREST, so granting them SELECT publishes the whole schema to
# anyone holding the publishable key. See migration 20240601000045.
GRANT_ROLES_SELECT = ("agent_readonly",)

# A statement matching any of these is a bug in this script, not a valid step.
_FORBIDDEN = (
    re.compile(r"\b(drop|truncate|delete\s+from|alter)\b[^;]*\bpublic\.", re.I),
    re.compile(r"\bdrop\s+schema\s+(if\s+exists\s+)?public\b", re.I),
    re.compile(r"\b(insert\s+into|update)\s+public\.", re.I),
)


def _existing_roles(cur: psycopg.Cursor, names: tuple[str, ...]) -> list[str]:
    cur.execute("select rolname from pg_roles where rolname = any(%s)", (list(names),))
    return [r[0] for r in cur.fetchall()]


def _public_tables(cur: psycopg.Cursor) -> list[str]:
    cur.execute(
        """
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
        """
    )
    return [r[0] for r in cur.fetchall()]


def _public_foreign_keys(cur: psycopg.Cursor) -> list[tuple[str, str, str]]:
    """Every FK on a `public` base table, as (table, constraint name, definition).

    `pg_get_constraintdef` writes same-schema targets UNQUALIFIED
    (`REFERENCES tenants(id)`) and cross-schema ones qualified
    (`REFERENCES auth.users(id)`). Replaying them with `search_path` set to the
    mirror therefore rebuilds the graph inside the mirror while leaving the
    `auth` references pointing at the real, project-level auth tables -- which is
    what you want, because auth is shared and has no mirror.
    """
    cur.execute(
        """
        SELECT t.relname, c.conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND c.contype = 'f' AND t.relkind = 'r'
        ORDER BY t.relname, c.conname
        """
    )
    return [(r[0], r[1], r[2]) for r in cur.fetchall()]


def _public_functions(cur: psycopg.Cursor) -> list[str]:
    """Definitions of every non-extension function/procedure in public."""
    cur.execute(
        """
        select pg_get_functiondef(p.oid)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prokind in ('f', 'p')
          and not exists (
            select 1 from pg_depend d
            where d.objid = p.oid and d.deptype = 'e'
          )
        order by p.proname
        """
    )
    return [r[0] for r in cur.fetchall()]


def _public_views(cur: psycopg.Cursor) -> list[tuple[str, str, bool]]:
    """(name, definition, is_materialized) for every view in public."""
    cur.execute(
        """
        select c.relname, pg_get_viewdef(c.oid, true), c.relkind = 'm'
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('v', 'm')
        order by c.relname
        """
    )
    return [(r[0], r[1], r[2]) for r in cur.fetchall()]


def _public_triggers(cur: psycopg.Cursor) -> list[str]:
    cur.execute(
        """
        select pg_get_triggerdef(t.oid)
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
        order by t.tgname
        """
    )
    return [r[0] for r in cur.fetchall()]


def _public_policies(cur: psycopg.Cursor) -> list[tuple[str, str, str, str, str, str | None, str | None]]:
    """(table, policy, permissive, cmd, roles, using, with_check) for every policy in public.

    Postgres has no `pg_get_policydef()`, so the CREATE POLICY statement is
    reassembled from pg_policies. Without this the mirror carries no RLS at all
    -- `CREATE TABLE ... (LIKE ...)` copies defaults, constraints and indexes,
    but never row security -- so a green integration run proved nothing about
    tenant isolation.
    """
    cur.execute(
        """
        select tablename, policyname, permissive, cmd,
               array_to_string(roles, ', '), qual, with_check
        from pg_policies
        where schemaname = 'public'
        order by tablename, policyname
        """
    )
    return [tuple(r) for r in cur.fetchall()]


def _rls_tables(cur: psycopg.Cursor) -> list[str]:
    """Tables in public with row level security enabled."""
    cur.execute(
        """
        select c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        order by c.relname
        """
    )
    return [r[0] for r in cur.fetchall()]


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _qualify_public_calls(expr: str, schema: str, fn_names: set[str]) -> str:
    """Point bare function calls in a policy body at the mirror's own clones.

    `pg_policies.qual` renders calls unqualified -- `get_my_tenant_id()`, not
    `public.get_my_tenant_id()` -- because public was on the search_path when
    the policy was created. Replayed verbatim into the mirror, those calls
    resolve through search_path and can land on the production function, which
    reads production's `profiles`. Then the mirror's policies silently consult
    production and the isolation test is worthless.
    """
    for name in sorted(fn_names, key=len, reverse=True):
        expr = re.sub(
            rf"(?<![\w.]){re.escape(name)}\s*\(",
            f"{_quote(schema)}.{_quote(name)}(",
            expr,
        )
    return expr


def _reschema(ddl: str, schema: str) -> str:
    """Point a public DDL definition at the mirror schema.

    Every `public.<thing>` reference becomes `<schema>.<thing>`, so a cloned
    function reads and writes the mirror instead of production. `auth.` and
    `storage.` references are left alone: those schemas are shared and the app
    only reads them. A bare `SET search_path = public` keeps public as a
    fallback so extension operators still resolve.
    """
    ddl = re.sub(r"(?i)\bsearch_path\s*=\s*public\b", f"search_path = {schema}, public", ddl)
    return re.sub(r"(?<![\w.])public\.", f"{schema}.", ddl)


def build_statements(cur: psycopg.Cursor, schema: str) -> list[sql.Composed]:
    ident = sql.Identifier(schema)
    stmts: list[sql.Composed] = [
        # Functions are emitted in catalog order, so a LANGUAGE sql body may
        # reference a sibling that does not exist yet. pg_dump does the same.
        sql.SQL("SET check_function_bodies = off"),
        sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(ident),
        sql.SQL("CREATE SCHEMA {}").format(ident),
    ]

    tables = _public_tables(cur)
    if not tables:
        raise SystemExit("ERROR: public has no base tables — refusing to continue")

    for table in tables:
        stmts.append(
            sql.SQL(
                "CREATE TABLE {}.{} (LIKE public.{} INCLUDING DEFAULTS "
                "INCLUDING CONSTRAINTS INCLUDING INDEXES INCLUDING GENERATED "
                "INCLUDING IDENTITY)"
            ).format(ident, sql.Identifier(table), sql.Identifier(table))
        )

    # Foreign keys, rebuilt to point INSIDE the mirror.
    #
    # This used to be skipped, and the omission was not free: PostgREST derives
    # its embed graph from foreign keys, so `select("*, tenants(...)")` -- the
    # workspace switcher -- answered PGRST200 "Could not find a relationship"
    # against the mirror while working fine in production. A mirror that cannot
    # reproduce a query production runs is not a mirror.
    #
    # The safety concern that motivated skipping them is real and handled: a
    # naive copy could leave `REFERENCES public.x`, pointing staging rows at
    # production ones. Any explicit `public.` is rewritten to the mirror, and the
    # SET below makes unqualified targets resolve there too.
    # `public` stays on the path behind the mirror: enum types like
    # `transaction_direction` live only in `public`, and the view bodies emitted
    # further down resolve them unqualified. The mirror comes FIRST, so an
    # unqualified FK target that exists in both binds to the mirror.
    stmts.append(sql.SQL("SET LOCAL search_path TO {}, public, pg_catalog").format(ident))
    for table, name, definition in _public_foreign_keys(cur):
        safe = re.sub(r"\bREFERENCES\s+public\.", f"REFERENCES {_quote(schema)}.", definition, flags=re.I)
        stmts.append(
            sql.SQL("ALTER TABLE {}.{} ADD CONSTRAINT {} " + safe).format(  # noqa: S608 — server-emitted DDL
                ident, sql.Identifier(table), sql.Identifier(name)
            )
        )

    # Back to the default for everything that follows; the narrow path above is
    # only meant to bind the FK targets.
    stmts.append(sql.SQL("SET LOCAL search_path TO public, pg_catalog"))

    # Functions before views and triggers: both can reference them.
    for definition in _public_functions(cur):
        stmts.append(sql.SQL(_reschema(definition, schema)))  # noqa: S608 — rewritten server DDL

    for name, definition, is_matview in _public_views(cur):
        kind = "MATERIALIZED VIEW" if is_matview else "VIEW"
        # Built by concatenation, not .format(): a view body may contain braces
        # (jsonb literals) that sql.SQL's formatter would try to interpret.
        target = f"{_quote(schema)}.{_quote(name)}"
        stmts.append(sql.SQL(f"CREATE {kind} {target} AS " + _reschema(definition, schema).rstrip(";")))

    for definition in _public_triggers(cur):
        stmts.append(sql.SQL(_reschema(definition, schema)))

    # Row security. Copied after the triggers so every referenced object
    # exists. Policy bodies go through _reschema so `public.get_my_tenant_id()`
    # resolves against the mirror's own clone rather than production.
    rls_tables = set(_rls_tables(cur))
    mirrored = set(tables)
    for table in sorted(rls_tables & mirrored):
        stmts.append(sql.SQL("ALTER TABLE {}.{} ENABLE ROW LEVEL SECURITY").format(ident, sql.Identifier(table)))

    fn_names = {
        m.group(1)
        for m in (re.search(r"(?is)FUNCTION\s+public\.\"?([\w]+)\"?\s*\(", d) for d in _public_functions(cur))
        if m
    }
    for table, policy, permissive, cmd, roles, using, with_check in _public_policies(cur):
        if table not in mirrored or not roles:
            continue
        parts = [
            f"CREATE POLICY {_quote(policy)} ON {_quote(schema)}.{_quote(table)}",
            f"AS {permissive}",
            f"FOR {cmd}",
            f"TO {roles}",
        ]
        if using:
            parts.append(f"USING ({_qualify_public_calls(_reschema(using, schema), schema, fn_names)})")
        if with_check:
            parts.append(f"WITH CHECK ({_qualify_public_calls(_reschema(with_check, schema), schema, fn_names)})")
        stmts.append(sql.SQL(" ".join(parts)))

    for role in _existing_roles(cur, GRANT_ROLES_ALL + GRANT_ROLES_SELECT):
        r = sql.Identifier(role)
        stmts.append(sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(ident, r))
        stmts.append(sql.SQL("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA {} TO {}").format(ident, r))
        stmts.append(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA {} GRANT EXECUTE ON FUNCTIONS TO {}").format(ident, r))
        if role in GRANT_ROLES_ALL:
            stmts.append(sql.SQL("GRANT ALL ON ALL TABLES IN SCHEMA {} TO {}").format(ident, r))
            stmts.append(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA {} GRANT ALL ON TABLES TO {}").format(ident, r))
        else:
            stmts.append(sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA {} TO {}").format(ident, r))
            stmts.append(sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA {} GRANT SELECT ON TABLES TO {}").format(ident, r))

    return stmts


def assert_safe(rendered: list[str]) -> None:
    for stmt in rendered:
        for pattern in _FORBIDDEN:
            if pattern.search(stmt):
                raise SystemExit(f"ABORT: statement would write to public:\n  {stmt}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print the SQL, execute nothing")
    parser.add_argument("--schema", default=TEST_SCHEMA, help=f"target schema (default: {TEST_SCHEMA})")
    args = parser.parse_args()

    if args.schema == "public":
        raise SystemExit("ABORT: refusing to target 'public'")

    with psycopg.connect(**_conn_kwargs()) as conn:
        with conn.cursor() as cur:
            statements = build_statements(cur, args.schema)
            rendered = [s.as_string(conn) for s in statements]
            assert_safe(rendered)

            if args.dry_run:
                print(";\n".join(rendered) + ";")
                print(f"\n-- dry run: {len(rendered)} statements, nothing executed", file=sys.stderr)
                return 0

            for stmt in statements:
                cur.execute(stmt)
        conn.commit()

    tables = len([s for s in rendered if s.startswith("CREATE TABLE")])
    print(f"rebuilt schema {args.schema}: {tables} tables cloned from public")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
