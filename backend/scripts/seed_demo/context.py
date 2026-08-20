"""Shared plumbing for the demo seed: connection, guards and id bookkeeping.

Why psycopg and not the Supabase client: this inserts tens of thousands of rows
and PostgREST would mean one HTTP round trip per batch plus RLS evaluation per
row. The pooler connection reuses `scripts.db_query`'s credential handling, so
there is exactly one place in the repo that knows how to reach the database.
"""

from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from collections.abc import Iterable, Iterator, Sequence
from typing import Any

import psycopg
from psycopg.rows import dict_row

from scripts.db_query import _conn_kwargs

# Fixed so the seed is idempotent and, more importantly, so the wipe can never
# be aimed at anything else. Hex-only per the UUID rules in CLAUDE.md.
DEMO_TENANT_ID = "dededede-0000-4000-8000-000000000001"
DEMO_TENANT_SLUG = "propos-demo"
DEMO_TENANT_NAME = "PropOS Demo"

# Every table the seed writes, in dependency order. The wipe walks this list in
# reverse. Keeping one list means a new generator cannot leave orphans behind.
SEEDED_TABLES: tuple[str, ...] = (
    "tenants",
    "organizations",
    "people",
    "places",
    "properties",
    "media_files",
    "media_assets",
    "projects",
    "project_properties",
    "publications",
    "pipelines",
    "opportunities",
    "opportunity_stage_history",
    "interactions",
    "interaction_participants",
    "interaction_targets",
    "tasks",
    "events",
    "reminders",
    "notes",
    "tags",
    "taggings",
    "documents",
    "document_versions",
    "document_assignments",
    "transactions",
    "client_conversations",
    "client_messages",
    "client_consents",
    "contacts",
)


class SeedAbortError(RuntimeError):
    """Raised when a guard refuses to run. Never caught inside the package."""


def assert_safe_to_write(tenant_id: str) -> None:
    """Refuse to touch anything that is not the demo tenant.

    The demo data lives in `public`, the same schema production serves, and the
    only thing separating it from real customer rows is this id. Treat the check
    as load-bearing, not as a formality: every INSERT and the wipe go through it.
    """
    if tenant_id != DEMO_TENANT_ID:
        raise SeedAbortError(f"refusing to write outside the demo tenant (got {tenant_id!r})")
    if os.environ.get("APP_ENV", "development") != "development" and os.environ.get("I_UNDERSTAND") != "1":
        raise SeedAbortError("APP_ENV is not 'development'; re-run with I_UNDERSTAND=1 if intended")


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    with psycopg.connect(**_conn_kwargs(), row_factory=dict_row) as conn:  # type: ignore[arg-type]
        yield conn


def new_id() -> str:
    return str(uuid.uuid4())


def insert_many(
    conn: psycopg.Connection,
    table: str,
    rows: Sequence[dict[str, Any]],
    *,
    conflict: str = "id",
) -> int:
    """Bulk INSERT ... ON CONFLICT DO NOTHING. Returns the row count attempted.

    Idempotency comes from the deterministic ids the generators build, so a
    re-run is a no-op rather than a duplicate load.
    """
    if not rows:
        return 0
    for row in rows:
        if row.get("tenant_id") is not None:
            assert_safe_to_write(row["tenant_id"])
    cols = list(rows[0].keys())
    placeholders = ", ".join(["%s"] * len(cols))
    collist = ", ".join(f'"{c}"' for c in cols)
    sql = f"INSERT INTO public.{table} ({collist}) VALUES ({placeholders}) ON CONFLICT ({conflict}) DO NOTHING"
    with conn.cursor() as cur:
        cur.executemany(sql, [tuple(r.get(c) for c in cols) for r in rows])
    return len(rows)


def wipe(conn: psycopg.Connection, tables: Iterable[str] = SEEDED_TABLES) -> None:
    """Delete the demo tenant's rows, children first. Never touches other tenants."""
    assert_safe_to_write(DEMO_TENANT_ID)
    with conn.cursor() as cur:
        for table in reversed(list(tables)):
            cur.execute(
                f"DELETE FROM public.{table} WHERE tenant_id = %s"
                if table != "tenants"
                else "DELETE FROM public.tenants WHERE id = %s",
                (DEMO_TENANT_ID,),
            )


@dataclass
class SeedContext:
    """Ids produced by earlier stages and consumed by later ones."""

    tenant_id: str = DEMO_TENANT_ID
    profile_ids: list[str] = field(default_factory=list)
    person_ids: list[str] = field(default_factory=list)
    # `people` is a view over `contacts`; media.py's FKs point at contacts(id),
    # so the same ids are exposed under both names rather than re-derived.
    contact_ids: list[str] = field(default_factory=list)
    organization_ids: list[str] = field(default_factory=list)
    property_ids: list[str] = field(default_factory=list)
    project_ids: list[str] = field(default_factory=list)
    opportunity_ids: list[str] = field(default_factory=list)
    interaction_ids: list[str] = field(default_factory=list)
    document_ids: list[str] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)

    def record(self, label: str, n: int) -> None:
        self.counts[label] = self.counts.get(label, 0) + n
