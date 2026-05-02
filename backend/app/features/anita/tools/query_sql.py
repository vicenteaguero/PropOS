"""Execute LLM-generated SELECTs through `anita_readonly` Postgres role.

Connection is opened per-call (not pooled) so we can scope:
- statement_timeout = 3s
- session-level GUC `request.jwt.claims` carrying the tenant_id, which
  the RLS policies on every domain table check via `get_my_tenant_id()`.

If `ANITA_READONLY_DB_URL` is unset (e.g. local dev w/o role), the tool
falls back to the supabase service-role client and we skip RLS — only
acceptable in test env.
"""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from app.features.anita.tools.sql_guard import GuardError, validate_and_normalize


def run_query_sql(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    intent = args.get("intent", "")
    sql_in = args.get("sql", "")
    if not sql_in.strip():
        return {"error": "missing sql"}

    try:
        sql = validate_and_normalize(sql_in)
    except GuardError as exc:
        return {"error": "sql_rejected", "reason": str(exc), "intent": intent}

    db_url = os.environ.get("ANITA_READONLY_DB_URL")
    if db_url:
        return _exec_psycopg(db_url, sql, tenant_id, intent)
    return _exec_supabase_fallback(sql, tenant_id, intent)


def _exec_psycopg(db_url: str, sql: str, tenant_id: UUID, intent: str) -> dict[str, Any]:
    try:
        import psycopg
    except ImportError:
        return {"error": "psycopg_not_installed"}

    claims = json.dumps({"tenant_id": str(tenant_id), "role": "authenticated"})
    try:
        with psycopg.connect(db_url, options="-c statement_timeout=3000") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims,))
                cur.execute(sql)
                cols = [d.name for d in cur.description] if cur.description else []
                rows = cur.fetchall()
        return {
            "intent": intent,
            "sql_executed": sql,
            "columns": cols,
            "rows": [dict(zip(cols, r, strict=False)) for r in rows],
            "row_count": len(rows),
        }
    except Exception as exc:  # pragma: no cover - upstream postgres errors
        return {"error": "execution_failed", "reason": str(exc), "sql_executed": sql}


def _exec_supabase_fallback(sql: str, tenant_id: UUID, intent: str) -> dict[str, Any]:
    """Local-dev path: hit the postgres URL Supabase exposes via PGRST RPC.

    We don't have a generic SELECT RPC, so this fallback just returns a
    stub explaining that the readonly role isn't configured. Tests in
    integration suite expect ANITA_READONLY_DB_URL set.
    """
    return {
        "error": "readonly_role_not_configured",
        "reason": "Set ANITA_READONLY_DB_URL to enable text-to-SQL.",
        "sql_validated": sql,
        "intent": intent,
    }
