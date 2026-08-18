"""Every query against a tenant-scoped table must carry a tenant predicate.

The backend talks to Postgres through a single service-role client, and
`service_role` holds BYPASSRLS. That means the 189 row-level policies in the
database do not protect the application's own queries at all: isolation rests
entirely on somebody remembering to write `.eq("tenant_id", ...)`. R3 recorded
that as P2-01, and the three cross-tenant leaks it produced in practice
(P1-03, P1-04, P1-08) were each exactly one forgotten predicate.

The audit's suggested fix -- move the backend onto per-request JWT clients so
RLS becomes the backstop -- is a large architectural change that would put 189
never-executed policies into the request path at once. This test is the cheap
half of the defence: it will not stop a bad query from being written, but it
stops one from being merged unnoticed.

Legitimate cross-tenant access is expected (webhooks arrive with no user, jobs
run for every tenant, tenant resolution happens before a tenant is known). Mark
those call sites with a comment on the same line as the `.table(` call:

    # tenant-safe: kapso webhooks arrive before any tenant is known
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[1] / "app"

# Tables carrying a tenant_id column whose rows belong to exactly one tenant.
# Kept explicit rather than derived from the database so the test stays
# hermetic and reviewable in the diff that adds a table.
TENANT_SCOPED = {
    "ads", "agent_messages", "agent_sessions", "agent_transcripts",
    "anonymous_upload_portals", "anonymous_uploads", "audit_log", "campaigns",
    "client_consents", "client_conversations", "client_messages", "contacts",
    "document_assignments", "document_versions", "documents", "email_accounts",
    "email_messages", "email_threads", "events", "import_jobs",
    "interaction_participants", "interaction_targets", "interactions",
    "internal_areas", "media_assets", "media_files", "notes", "opportunities",
    "opportunity_stage_history", "organizations", "pending_proposals", "people",
    "person_aliases", "places", "project_properties", "projects", "properties",
    "property_grants", "publications", "reminders", "share_link_history",
    "share_links", "taggings", "tags", "tasks", "transactions", "workflows",
}

ESCAPE_HATCH = re.compile(r"#\s*tenant-safe:\s*\S")

# A predicate that pins the query to one tenant, in any form supabase-py allows.
TENANT_PREDICATE = re.compile(
    r"""\.eq\(\s*['"]tenant_id['"]|"""
    r"""\.in_\(\s*['"]tenant_id['"]|"""
    r"""\.match\(\s*\{[^}]*['"]tenant_id['"]|"""
    r"""\.filter\(\s*['"]tenant_id['"]|"""
    r"""['"]tenant_id['"]\s*:""",  # insert/update payload carrying tenant_id
    re.S,
)

TABLE_CALL = re.compile(r"\.table\(\s*['\"]([a-z_]+)['\"]")

# Only reads and mutations of existing rows can cross a tenant boundary.
READ_OR_WRITE = re.compile(r"\.(select|update|delete|upsert)\(")


def _chains(source: str) -> list[tuple[int, str]]:
    """Full query chains: the outermost call of each `.table(...).….execute()`."""
    tree = ast.parse(source)
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        try:
            text = ast.unparse(node)
        except Exception:  # pragma: no cover - unparse is total in practice
            continue
        # Only the outermost node of a chain ends in .execute(); inner Call
        # nodes of the same chain do not, so each chain is counted once.
        if not text.endswith(".execute()") or ".table(" not in text:
            continue
        found.append((node.lineno, text))
    return found


def _violations() -> list[str]:
    out: list[str] = []
    for path in sorted(APP.rglob("*.py")):
        source = path.read_text()
        lines = source.splitlines()
        for lineno, chain in _chains(source):
            tables = set(TABLE_CALL.findall(chain))
            scoped = tables & TENANT_SCOPED
            if not scoped:
                continue
            if TENANT_PREDICATE.search(chain):
                continue
            # Inserts are not a read-leak vector: every tenant-scoped table has
            # `tenant_id NOT NULL`, so an insert that forgot it fails loudly at
            # the database instead of quietly returning another tenant's rows.
            if READ_OR_WRITE.search(chain) is None:
                continue
            # The hatch may sit on the chain's first line or on the `.table(` line.
            window = "\n".join(lines[max(0, lineno - 2) : lineno + len(chain.splitlines()) + 1])
            if ESCAPE_HATCH.search(window):
                continue
            rel = path.relative_to(APP.parents[1])
            one_line = " ".join(chain.split())
            out.append(f"{rel}:{lineno} → {one_line[:150]}")
    return out


def test_no_unscoped_queries_on_tenant_tables() -> None:
    violations = _violations()
    assert not violations, (
        "queries on tenant-scoped tables with no tenant predicate.\n"
        "The service-role client bypasses RLS, so a missing predicate is a\n"
        "cross-tenant read. Add .eq('tenant_id', ...) or, if the access is\n"
        "legitimately cross-tenant, a '# tenant-safe: <why>' comment.\n\n"
        + "\n".join(violations)
    )


def test_the_check_can_actually_fail() -> None:
    """Guard against the matcher silently accepting everything."""
    bad = 'client.table("contacts").select("id").execute()'
    good = 'client.table("contacts").select("id").eq("tenant_id", str(tid)).execute()'
    assert not TENANT_PREDICATE.search(bad)
    assert TENANT_PREDICATE.search(good)
    assert TABLE_CALL.findall(bad) == ["contacts"]


@pytest.mark.parametrize("table", sorted(TENANT_SCOPED))
def test_tenant_scoped_list_is_accurate(table: str) -> None:
    """Every name listed here is referenced somewhere in the app."""
    assert table
