"""Quick SQL query runner against Supabase Postgres (read-only by default).

Usage:
    poetry run python -m scripts.db_query "select * from kapso_webhook_events limit 5"
    poetry run python -m scripts.db_query path/to/query.sql
    poetry run python -m scripts.db_query --write "update foo set ..."  # explicit opt-in

Reads pooler URL from supabase/.temp/pooler-url + password from
SUPABASE_DB_PASSWORD env (same as `make migrate`).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def _read_env_password() -> str:
    """Read SUPABASE_DB_PASSWORD directly from .env to bypass Make's $-expansion."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        raise SystemExit(f".env not found at {env_path}")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        if k.strip() == "SUPABASE_DB_PASSWORD":
            return v.strip().strip("'\"")
    raise SystemExit("SUPABASE_DB_PASSWORD missing in .env")


def _conn_kwargs() -> dict[str, str | int]:
    pwd = _read_env_password()
    pooler_path = Path(__file__).resolve().parents[2] / "supabase" / ".temp" / "pooler-url"
    if not pooler_path.exists():
        raise SystemExit(f"pooler-url missing: {pooler_path}")
    pooler = pooler_path.read_text().strip()
    # postgresql://user@host:port/dbname
    m = re.match(r"^postgresql://([^@]+)@([^:/]+):(\d+)/(\w+)$", pooler)
    if not m:
        raise SystemExit(f"unrecognized pooler-url: {pooler}")
    user, host, port, dbname = m.groups()
    return dict(host=host, port=int(port), user=user, password=pwd, dbname=dbname)


def _resolve_sql(arg: str) -> str:
    p = Path(arg)
    if p.exists() and p.is_file():
        return p.read_text()
    return arg


def main() -> None:
    args = sys.argv[1:]
    if not args:
        raise SystemExit("usage: db_query [--write] '<sql>' | path/to.sql")

    write = False
    if args[0] == "--write":
        write = True
        args = args[1:]
    if not args:
        raise SystemExit("missing SQL")

    sql = _resolve_sql(args[0])
    is_select = sql.lstrip().lower().startswith(("select", "with", "explain", "show"))
    if not is_select and not write:
        raise SystemExit(
            "non-SELECT query — pass --write to confirm: "
            "db_query --write 'update ...'"
        )

    with psycopg.connect(**_conn_kwargs(), row_factory=dict_row, autocommit=not write) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(sql)
            except psycopg.errors.UndefinedColumn as exc:
                _hint_columns(conn, sql, str(exc))
                raise SystemExit(1) from None
            except psycopg.errors.UndefinedTable as exc:
                _hint_tables(conn, str(exc))
                raise SystemExit(1) from None
            if cur.description:
                rows = cur.fetchall()
                _print_table(rows)
                print(f"\n({len(rows)} rows)")
            else:
                print(f"OK ({cur.rowcount} rows affected)")
        if write:
            conn.commit()


def _hint_columns(conn, sql: str, err: str) -> None:
    print(f"ERROR: {err.strip()}", file=sys.stderr)
    # Try to extract table names from FROM/UPDATE/INTO clauses.
    tables = set(re.findall(r"\b(?:from|join|update|into)\s+([a-zA-Z_][\w\.]*)", sql, re.IGNORECASE))
    if not tables:
        return
    with conn.cursor() as cur:
        for t in tables:
            schema = "public"
            name = t
            if "." in t:
                schema, name = t.split(".", 1)
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position",
                (schema, name),
            )
            cols = [r["column_name"] for r in cur.fetchall()]
            if cols:
                print(f"\nColumns in {schema}.{name}:", file=sys.stderr)
                for c in cols:
                    print(f"  - {c}", file=sys.stderr)


def _hint_tables(conn, err: str) -> None:
    print(f"ERROR: {err.strip()}", file=sys.stderr)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        )
        names = [r["table_name"] for r in cur.fetchall()]
        print("\nAvailable public tables:", file=sys.stderr)
        for n in names:
            print(f"  - {n}", file=sys.stderr)


def _print_table(rows: list[dict]) -> None:
    if not rows:
        print("(empty)")
        return
    cols = list(rows[0].keys())
    widths = {c: max(len(c), max(len(str(r.get(c, ""))[:60]) for r in rows)) for c in cols}
    line = " | ".join(c.ljust(widths[c]) for c in cols)
    print(line)
    print("-+-".join("-" * widths[c] for c in cols))
    for r in rows:
        print(" | ".join(str(r.get(c, ""))[:60].ljust(widths[c]) for c in cols))


if __name__ == "__main__":
    main()
