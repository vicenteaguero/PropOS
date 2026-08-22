"""Empty one tenant's operational data, leaving the tenant itself usable.

Written for the day ANAIDA stopped being a scratchpad and started being the
brokerage's real workspace: the tenant carried one sample property, its sample
document and two leftover Propo audio files from testing. Rows a broker would
open on their first morning and reasonably assume were real.

What it keeps, deliberately:
  - the tenant row and its settings (brand colour, assistant name)
  - profiles, memberships, user emails/phones, push subscriptions
  - the configurable catalogs -- message templates, checklists, pipelines and
    their transitions, tags, internal areas, email accounts. Those are setup,
    not data, and wiping them silently turns the pipeline state machine off
    (`assert_allowed` returns early for a pipeline with zero transitions).

Everything else that carries a `tenant_id` goes -- including the tenant's
objects in the `media` and `documents` buckets. Emptying only the tables leaves
the files behind as unreferenced storage nobody can reach or bill correctly: the
first wipe of ANAIDA left 45 such objects.

Ordering is not hardcoded. The script loops over the delete set, keeps the
tables whose delete failed on a foreign key, and goes round again until a pass
makes no progress -- so a new child table added later needs no edit here.

Usage:
    poetry run python -m scripts.reset_tenant_data <tenant-uuid>          # dry run
    CONFIRM=1 poetry run python -m scripts.reset_tenant_data <tenant-uuid>
    CONFIRM=1 poetry run python -m scripts.reset_tenant_data <tenant-uuid> --with-audit
"""

from __future__ import annotations

import os
import sys
import uuid

import psycopg
from psycopg.rows import dict_row

from app.core.supabase.client import get_supabase_client
from scripts.db_query import _conn_kwargs

#: Both are private, both are laid out as `<tenant_id>/...` (see the four
#: tenant-scoped policies on each, migration `..._storage_policies`).
STORAGE_BUCKETS = ("media", "documents")

#: Setup and identity. Deleting any of these breaks the tenant rather than
#: emptying it.
PROTECTED = {
    "profiles",
    "tenant_memberships",
    "user_emails",
    "user_phones",
    "notification_subscriptions",
    "message_templates",
    "checklist_templates",
    "checklist_template_items",
    "pipelines",
    "pipeline_transitions",
    "tags",
    "internal_areas",
    "email_accounts",
    "feature_states",
}

#: The audit trail is a ledger, not tenant data -- `docs/disaster-recovery.md`
#: replays it to reconstruct deleted rows, which is exactly the situation a
#: script like this creates. Kept unless the caller asks for it explicitly.
AUDIT_TABLES = {"audit_log"}


def _tenant_tables(cur) -> list[str]:
    cur.execute(
        """
        select c.relname as table_name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
        where n.nspname = 'public'
          and c.relkind = 'r'            -- base tables only; views carry tenant_id too
          and a.attname = 'tenant_id'
          and not a.attisdropped
        order by 1
        """
    )
    return [r["table_name"] for r in cur.fetchall()]


def _counts(cur, tables: list[str], tenant_id: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for t in tables:
        cur.execute(f'select count(*) as n from "{t}" where tenant_id = %s', (tenant_id,))
        n = cur.fetchone()["n"]
        if n:
            out[t] = n
    return out


def _storage_objects(client, bucket: str, prefix: str, depth: int = 0) -> list[str]:
    """Every object under `prefix`, recursively.

    The Storage list API returns one directory level at a time and marks a
    pseudo-directory by giving it a null `id`, so the recursion is on that.
    """
    found: list[str] = []
    entries = client.storage.from_(bucket).list(prefix, {"limit": 1000})
    for entry in entries or []:
        name = entry.get("name")
        if not name:
            continue
        full = f"{prefix}/{name}" if prefix else name
        if entry.get("id") is None and depth < 6:
            found.extend(_storage_objects(client, bucket, full, depth + 1))
        else:
            found.append(full)
    return found


def wipe_storage(tenant_id: str, confirm: bool) -> int:
    client = get_supabase_client()
    total = 0
    for bucket in STORAGE_BUCKETS:
        try:
            paths = _storage_objects(client, bucket, tenant_id)
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN listing {bucket}: {exc}", file=sys.stderr)
            continue
        if not paths:
            continue
        total += len(paths)
        if not confirm:
            print(f"  {bucket:<32} {len(paths)} objects")
            continue
        # The API caps a remove() call; chunk rather than trust one big list.
        for i in range(0, len(paths), 100):
            client.storage.from_(bucket).remove(paths[i : i + 100])
        print(f"deleted {len(paths):>5} objects from bucket {bucket}")
    return total


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: reset_tenant_data <tenant-uuid>", file=sys.stderr)
        return 2
    tenant_id = sys.argv[1].strip()
    try:
        uuid.UUID(tenant_id)
    except ValueError:
        print(f"not a uuid: {tenant_id}", file=sys.stderr)
        return 2

    confirm = os.environ.get("CONFIRM") == "1"
    with_audit = "--with-audit" in sys.argv

    with psycopg.connect(**_conn_kwargs(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, name, slug from tenants where id = %s", (tenant_id,))
            tenant = cur.fetchone()
            if not tenant:
                print(f"no tenant with id {tenant_id}", file=sys.stderr)
                return 1

            protected = PROTECTED if with_audit else PROTECTED | AUDIT_TABLES
            tables = [t for t in _tenant_tables(cur) if t not in protected]
            before = _counts(cur, tables, tenant_id)

            print(f"tenant: {tenant['name']} ({tenant['slug']}) {tenant_id}")
            if not before:
                print("no table rows to delete")
                if wipe_storage(tenant_id, confirm=confirm) == 0:
                    print("no storage objects either — already empty")
                return 0
            print("rows to delete:")
            for t, n in sorted(before.items(), key=lambda kv: -kv[1]):
                print(f"  {t:<32} {n}")
            print(f"  {'TOTAL':<32} {sum(before.values())}")

            print("storage objects to delete:")
            if wipe_storage(tenant_id, confirm=False) == 0:
                print("  (none)")

            if not confirm:
                print("\ndry run. re-run with CONFIRM=1 to delete.")
                return 0

            pending = list(before)
            deleted: dict[str, int] = {}
            while pending:
                blocked: list[str] = []
                progress = False
                for t in pending:
                    try:
                        with conn.transaction():
                            cur.execute(f'delete from "{t}" where tenant_id = %s', (tenant_id,))
                            deleted[t] = cur.rowcount
                        progress = True
                    except psycopg.errors.ForeignKeyViolation:
                        blocked.append(t)
                if not progress:
                    print(f"\nSTUCK on: {', '.join(blocked)}", file=sys.stderr)
                    print("a foreign key cycle needs a manual order here", file=sys.stderr)
                    return 1
                pending = blocked

            for t, n in sorted(deleted.items(), key=lambda kv: -kv[1]):
                if n:
                    print(f"deleted {n:>5} from {t}")

            # The universal audit trigger records the deletes themselves, so
            # audit_log is populated again the moment it is emptied. That is the
            # ledger working, not a failed wipe.
            leftover = {t: n for t, n in _counts(cur, tables, tenant_id).items() if t not in AUDIT_TABLES}
            if leftover:
                print(f"\nWARNING still populated: {leftover}", file=sys.stderr)
                return 1
            wipe_storage(tenant_id, confirm=True)
            print("\ntenant data cleared")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
