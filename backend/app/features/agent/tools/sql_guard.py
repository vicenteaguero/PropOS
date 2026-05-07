"""SQL allowlist for Anita's text-to-SQL tool.

Defense in depth (the first two layers; the third is Postgres):
1. **Parse with sqlglot** — must be a single `SELECT` AST. No DDL, DML, CTE
   that writes, no `pg_*` system catalog reads, no `COPY`, no functions
   outside the whitelist below.
2. **Inject `LIMIT 200`** if absent.
3. **Postgres role** (`anita_readonly`, see migration) only has `SELECT`
   on `public.*`; RLS is enforced via `set_config('request.jwt.claims', ...)`
   when the connection is opened.
"""

from __future__ import annotations

from dataclasses import dataclass

import sqlglot
from sqlglot import exp

# Functions safe to call. Everything else rejected.
ALLOWED_FUNCTIONS = {
    # Aggregates
    "count",
    "sum",
    "avg",
    "min",
    "max",
    # Date helpers
    "now",
    "current_date",
    "current_timestamp",
    "date_trunc",
    "date_part",
    "to_char",
    "to_date",
    "to_timestamp",
    "extract",
    "age",
    # String helpers
    "lower",
    "upper",
    "trim",
    "concat",
    "coalesce",
    "nullif",
    # Type casts
    "cast",
}

FORBIDDEN_TABLE_PREFIXES = ("pg_", "information_schema")

DEFAULT_ROW_CAP = 200


@dataclass
class GuardError(ValueError):
    reason: str

    def __str__(self) -> str:
        return self.reason


def validate_and_normalize(sql: str, *, row_cap: int = DEFAULT_ROW_CAP) -> str:
    """Parse, validate, and inject LIMIT. Return the normalized SQL.

    Raises GuardError if the statement is rejected.
    """
    sql = sql.strip().rstrip(";")
    try:
        statements = sqlglot.parse(sql, read="postgres")
    except sqlglot.errors.ParseError as exc:
        raise GuardError(f"parse error: {exc}") from exc

    if not statements or len(statements) != 1:
        raise GuardError("exactly one statement required")

    tree = statements[0]
    if not isinstance(tree, exp.Select):
        raise GuardError(f"only SELECT allowed (got {type(tree).__name__})")

    # No mutations anywhere in the tree.
    forbidden_nodes = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Merge,
        exp.Create,
        exp.Drop,
        exp.Alter,
        exp.TruncateTable,
        exp.Command,
    )
    for forbidden in forbidden_nodes:
        if tree.find(forbidden) is not None:
            raise GuardError(f"forbidden node {forbidden.__name__} present")

    # No system tables.
    for table in tree.find_all(exp.Table):
        name = (table.name or "").lower()
        for prefix in FORBIDDEN_TABLE_PREFIXES:
            if name.startswith(prefix):
                raise GuardError(f"forbidden table {name!r}")

    # Function allowlist.
    for func in tree.find_all(exp.Func):
        fname = (func.sql_name() or func.key or "").lower()
        if fname and fname not in ALLOWED_FUNCTIONS:
            raise GuardError(f"forbidden function {fname!r}")

    # Inject LIMIT if missing or too large.
    existing_limit = tree.args.get("limit")
    if existing_limit is None:
        tree.set("limit", exp.Limit(expression=exp.Literal.number(row_cap)))
    else:
        try:
            current = int(existing_limit.expression.name)
            if current > row_cap:
                tree.set("limit", exp.Limit(expression=exp.Literal.number(row_cap)))
        except (AttributeError, ValueError):
            tree.set("limit", exp.Limit(expression=exp.Literal.number(row_cap)))

    return tree.sql(dialect="postgres")
