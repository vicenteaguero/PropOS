"""LLM-driven text-to-SQL for Anita's `query_freeform` intent.

Pipeline: load schema → ask Groq for a single SELECT → validate via
``sql_guard`` → execute via ``query_sql``. Returns rows + the SQL the
model wrote so the caller can show it back to the user.
"""

from __future__ import annotations

import os
import time
from typing import Any
from uuid import UUID

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.features.anita.tools.query_sql import run_query_sql

logger = get_logger("ANITA_TEXT_SQL")

# Tables we expose to the model. Keep tight — every table costs prompt
# tokens and increases the chance of writing a confused JOIN.
_EXPOSED_TABLES = (
    "properties", "contacts", "people", "organizations",
    "interactions", "interaction_participants", "interaction_targets",
    "tasks", "transactions", "projects", "project_properties",
    "campaigns", "documents", "notes", "tags", "taggings",
    "pending_proposals",
)

_SCHEMA_CACHE: dict[str, Any] = {"at": 0.0, "text": ""}
_SCHEMA_TTL_SECONDS = 300.0


def _load_schema_hint() -> str:
    now = time.time()
    if _SCHEMA_CACHE["text"] and (now - _SCHEMA_CACHE["at"]) < _SCHEMA_TTL_SECONDS:
        return _SCHEMA_CACHE["text"]

    db_url = os.environ.get("ANITA_READONLY_DB_URL")
    if not db_url:
        return ""
    try:
        import psycopg
    except ImportError:
        return ""

    placeholders = ",".join(["%s"] * len(_EXPOSED_TABLES))
    query = (
        "SELECT table_name, column_name, data_type, ordinal_position "
        "FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name IN ({placeholders}) "
        "ORDER BY table_name, ordinal_position"
    )
    by_table: dict[str, list[tuple[int, str, str]]] = {}
    try:
        with psycopg.connect(db_url, options="-c statement_timeout=3000") as conn:
            with conn.cursor() as cur:
                cur.execute(query, list(_EXPOSED_TABLES))
                for table_name, column_name, data_type, pos in cur.fetchall():
                    by_table.setdefault(table_name, []).append((pos, column_name, data_type))
    except Exception as exc:
        logger.warning("schema_load_failed", error=str(exc))
        return ""

    lines: list[str] = []
    for table in _EXPOSED_TABLES:
        cols = sorted(by_table.get(table, []), key=lambda x: x[0])
        if not cols:
            continue
        col_str = ", ".join(f"{c}:{t}" for _, c, t in cols)
        lines.append(f"{table}({col_str})")
    text = "\n".join(lines)
    _SCHEMA_CACHE["text"] = text
    _SCHEMA_CACHE["at"] = now
    return text


_SYSTEM_PROMPT = """\
Genera UNA consulta SQL Postgres (un solo SELECT) que responda la pregunta del usuario.

Reglas estrictas:
- SOLO SELECT. Nada de INSERT/UPDATE/DELETE/DDL.
- Filtra siempre por tenant_id cuando la tabla lo tenga (te lo paso en el prompt).
- Excluye filas con deleted_at IS NOT NULL si la columna existe.
- Usa LIMIT 100 como máximo si no hay agregación.
- Devuelve SOLO la sentencia SQL. Sin comentarios, sin markdown, sin explicación.
- Si la pregunta no se puede responder con el esquema, devuelve exactamente: NO_SQL

Esquema disponible (tabla(col:tipo, ...)):
{schema}
"""


async def generate_and_run_sql(
    user_question: str,
    tenant_id: UUID,
) -> dict[str, Any]:
    """Returns {kind, ...}:
      - {kind: "query_sql", sql, rows, columns, row_count}
      - {kind: "out_of_scope", message}
      - {kind: "error", reason, sql?}
    """
    from openai import AsyncOpenAI

    schema_hint = _load_schema_hint()
    if not schema_hint:
        return {"kind": "error", "reason": "schema_unavailable"}

    system = _SYSTEM_PROMPT.format(schema=schema_hint)
    user_msg = f"tenant_id = '{tenant_id}'\n\nPregunta: {user_question}"

    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
        timeout=20.0,
    )
    try:
        completion = await client.chat.completions.create(
            model=settings.anita_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
            max_tokens=400,
        )
    except Exception as exc:
        logger.warning("text_to_sql_llm_failed", error=str(exc))
        return {"kind": "error", "reason": f"llm_failed: {exc}"}

    raw = (completion.choices[0].message.content or "").strip()
    sql = raw.strip().strip("`").strip()
    if sql.lower().startswith("sql"):
        sql = sql[3:].strip()
    if sql.upper() == "NO_SQL" or not sql:
        return {
            "kind": "out_of_scope",
            "message": "No pude traducir esa pregunta a una consulta concreta.",
        }

    result = run_query_sql({"sql": sql, "intent": user_question}, tenant_id)
    if "error" in result:
        return {"kind": "error", "reason": result.get("reason", result["error"]), "sql": sql}

    return {
        "kind": "query_sql",
        "sql": result.get("sql_executed", sql),
        "columns": result.get("columns", []),
        "rows": result.get("rows", []),
        "row_count": result.get("row_count", 0),
    }
