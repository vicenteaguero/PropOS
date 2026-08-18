"""SQL allowlist for Agent's text-to-SQL tool.

Defense in depth (the first four layers; the fifth is Postgres):
1. **Parse with sqlglot** — must be a single `SELECT` AST. No DDL, DML, CTE
   that writes, no system catalog reads, no `COPY`, no functions outside the
   whitelist below.
2. **Table allowlist** — every relation must be one of `EXPOSED_TABLES`, or a
   CTE defined in the same statement.
3. **Tenant predicate** — every allowlisted relation must carry
   `tenant_id = '<the caller's uuid>'`. The `agent_readonly` policies already
   filter by tenant; this exists because the SQL is written by a language model
   from a prose instruction, and prose is not an isolation boundary.
4. **Inject `LIMIT 200`** if absent.
5. **Postgres role** (`agent_readonly`, see migration) has `SELECT` only on the
   exposed tables, with per-tenant policies keyed to `app.current_tenant_id`.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

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

# sqlglot rewrites several Postgres functions into its own canonical
# expressions, so the Postgres spelling in ALLOWED_FUNCTIONS never matches what
# the parser produces. Anonymous functions keep their identifier (which is how
# `age` passes and `pg_read_file` is caught), but these five do not.
_CANONICAL_TO_PG = {
    "timestamp_trunc": "date_trunc",
    "time_to_str": "to_char",
    "str_to_date": "to_date",
    "unix_to_time": "to_timestamp",
}

# Relations the model may read. Mirrors the GRANTs held by `agent_readonly`
# and the schema hint the text-to-SQL prompt advertises.
EXPOSED_TABLES = frozenset(
    {
        "properties",
        "contacts",
        "people",
        "organizations",
        "interactions",
        "interaction_participants",
        "interaction_targets",
        "tasks",
        "transactions",
        "projects",
        "project_properties",
        "campaigns",
        "documents",
        "notes",
        "tags",
        "taggings",
        "pending_proposals",
    }
)

TENANT_COLUMN = "tenant_id"

DEFAULT_ROW_CAP = 200


@dataclass
class GuardError(ValueError):
    reason: str

    def __str__(self) -> str:
        return self.reason


def validate_and_normalize(
    sql: str,
    *,
    tenant_id: UUID | str | None = None,
    row_cap: int = DEFAULT_ROW_CAP,
) -> str:
    """Parse, validate, and inject LIMIT. Return the normalized SQL.

    ``tenant_id`` turns on the allowlist + tenant-predicate checks. It is
    optional only so the guard stays usable for parsing-level unit tests; every
    real caller passes it.

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

    # No system tables. Check the schema and catalog parts too, not just the
    # bare relation: in `information_schema.columns` sqlglot puts the schema in
    # `.db`, so matching only `.name` let the entire information_schema through.
    # `pg_*` was blocked by accident, because those relations happen to be named
    # `pg_...` themselves.
    for table in tree.find_all(exp.Table):
        parts = [(table.name or "").lower(), (table.db or "").lower(), (table.catalog or "").lower()]
        for part in parts:
            if not part:
                continue
            for prefix in FORBIDDEN_TABLE_PREFIXES:
                if part.startswith(prefix):
                    raise GuardError(f"forbidden table {part!r}")

    if tenant_id is not None:
        cte_names = {(cte.alias_or_name or "").lower() for cte in tree.find_all(exp.CTE)}
        relations = [t for t in tree.find_all(exp.Table) if (t.name or "").lower() not in cte_names]
        _enforce_table_allowlist(relations)
        _enforce_tenant_predicate(tree, relations, tenant_id)

    # Function allowlist. sqlglot canonicalises names, so the Postgres spelling
    # the allowlist is written in never matches: date_trunc -> timestamp_trunc,
    # to_char -> time_to_str, to_date -> str_to_date, to_timestamp ->
    # unix_to_time, age -> anonymous. Accept either spelling, and for anonymous
    # functions fall back to the identifier as written in the query --
    # `date_trunc` broke every "agrupado por mes" question the agent exists to
    # answer.
    for func in tree.find_all(exp.Func):
        canonical = (func.sql_name() or "").lower()
        candidates = {
            canonical,
            (func.key or "").lower(),
            (func.name or "").lower(),
            _CANONICAL_TO_PG.get(canonical, ""),
        }
        candidates.discard("")
        if candidates and not (candidates & ALLOWED_FUNCTIONS):
            raise GuardError(f"forbidden function {sorted(candidates)[0]!r}")

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


def _enforce_table_allowlist(relations: list[exp.Table]) -> None:
    """Strict allowlist. Broader than the `pg_*`/`information_schema` denylist
    above: anything not deliberately exposed is refused by default."""
    for table in relations:
        name = (table.name or "").lower()
        if name not in EXPOSED_TABLES:
            raise GuardError(f"table {name!r} is not exposed to the agent")
        schema = (table.db or "").lower()
        if schema and schema != "public":
            raise GuardError(f"forbidden schema {schema!r}")


def _literal_text(node: exp.Expression | None) -> str | None:
    """Unwrap `'<uuid>'`, `('<uuid>')` and `'<uuid>'::uuid` down to the string."""
    while isinstance(node, exp.Cast | exp.Paren):
        node = node.this
    if isinstance(node, exp.Literal) and node.is_string:
        return node.this
    return None


def _scope_tables(select: exp.Select) -> list[exp.Table]:
    """Relations selected directly by this SELECT (its FROM and its JOINs).

    Nested SELECTs own their own relations, so they are not counted here — that
    is what makes an unqualified predicate attributable.
    """
    tables: list[exp.Table] = []
    from_clause = select.args.get("from")
    if from_clause is not None and isinstance(from_clause.this, exp.Table):
        tables.append(from_clause.this)
    for join in select.args.get("joins") or []:
        if isinstance(join.this, exp.Table):
            tables.append(join.this)
    return tables


def _scope_equalities(select: exp.Select) -> list[exp.EQ]:
    """Equality predicates belonging to this SELECT: its WHERE and its JOIN ON
    clauses, stopping at any nested SELECT."""
    found: list[exp.EQ] = []

    def collect(node: exp.Expression) -> None:
        if isinstance(node, exp.Select):
            return
        if isinstance(node, exp.EQ):
            found.append(node)
        for child in node.iter_expressions():
            collect(child)

    roots: list[exp.Expression | None] = [select.args.get("where")]
    roots.extend(select.args.get("joins") or [])
    for root in roots:
        if root is not None:
            collect(root)
    return found


def _tenant_predicate_scopes(equalities: list[exp.EQ], tenant_id: str) -> tuple[set[str], bool]:
    """Table qualifiers pinned to `tenant_id`, and whether an unqualified
    `tenant_id = '<tenant_id>'` is present."""
    qualified: set[str] = set()
    unqualified = False
    for eq in equalities:
        for column, other in ((eq.this, eq.expression), (eq.expression, eq.this)):
            if not isinstance(column, exp.Column) or (column.name or "").lower() != TENANT_COLUMN:
                continue
            value = _literal_text(other)
            if value is None or value.lower() != tenant_id:
                continue
            source = (column.table or "").lower()
            if source:
                qualified.add(source)
            else:
                unqualified = True
    return qualified, unqualified


def _enforce_tenant_predicate(tree: exp.Expression, relations: list[exp.Table], tenant_id: UUID | str) -> None:
    """Every relation in the query must be pinned to the caller's tenant.

    The prompt asks the model to filter by tenant_id; asking is not enforcing.
    A JOIN whose second table lost its predicate would read across tenants the
    moment the `agent_readonly` policies are relaxed.

    Checked per SELECT scope so `WHERE tenant_id = '<uuid>'` (unqualified, the
    natural spelling for a single-table query) counts for that scope's only
    relation, while a two-relation scope must qualify each one.
    """
    if not relations:
        return
    expected = str(tenant_id).lower()
    uncovered = {id(table): table for table in relations}

    for select in tree.find_all(exp.Select):
        tables = _scope_tables(select)
        if not tables:
            continue
        qualified, unqualified = _tenant_predicate_scopes(_scope_equalities(select), expected)
        for table in tables:
            key = (table.alias or table.name or "").lower()
            if key in qualified or (unqualified and len(tables) == 1):
                uncovered.pop(id(table), None)

    if uncovered:
        missing = sorted({(t.alias or t.name or "?").lower() for t in uncovered.values()})
        raise GuardError(f"missing tenant_id predicate for {missing[0]!r}")
