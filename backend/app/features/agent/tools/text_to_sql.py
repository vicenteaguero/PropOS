"""LLM-driven text-to-SQL for Agent's `query_freeform` intent.

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
from app.features.agent.llm_retry import with_retry
from app.features.agent.rate_limiter import QuotaExhaustedError, get_rate_limiter
from app.features.agent.tools.query_sql import run_query_sql

logger = get_logger("AGENT_TEXT_SQL")

# Tables we expose to the model. Keep tight — every table costs prompt
# tokens and increases the chance of writing a confused JOIN.
_EXPOSED_TABLES = (
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
)

_SCHEMA_CACHE: dict[str, Any] = {"at": 0.0, "text": ""}
_SCHEMA_TTL_SECONDS = 300.0


def _load_schema_hint() -> str:
    now = time.time()
    if _SCHEMA_CACHE["text"] and (now - _SCHEMA_CACHE["at"]) < _SCHEMA_TTL_SECONDS:
        return _SCHEMA_CACHE["text"]

    db_url = os.environ.get("AGENT_READONLY_DB_URL")
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

    # Pass 2 of a freeform question is a real call against the same Groq quota
    # as the classifier. Skipping the limiter here made it under-count, so the
    # provider returned 429s the user saw as "hubo un error al consultar".
    limiter = get_rate_limiter()
    est_tokens = (len(system) + len(user_msg)) // 4
    try:
        # Tighter than the default budget: the dispatcher runs this call in a
        # worker thread it only waits 30s for.
        await limiter.acquire(settings.agent_provider, settings.agent_model, est_tokens, max_wait=10.0)
    except QuotaExhaustedError as exc:
        logger.warning("text_to_sql_quota_exhausted", window=exc.window, wait_seconds=int(exc.wait_seconds))
        return {"kind": "error", "reason": "quota_exhausted"}

    try:
        raw_response = await with_retry(
            lambda: client.chat.completions.with_raw_response.create(
                model=settings.agent_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0,
                max_tokens=400,
            ),
            what="text_to_sql",
        )
    except Exception as exc:
        logger.warning("text_to_sql_llm_failed", error=str(exc))
        return {"kind": "error", "reason": f"llm_failed: {exc}"}

    completion = raw_response.parse()
    usage = completion.usage
    actual = (usage.prompt_tokens if usage else 0) + (usage.completion_tokens if usage else 0)
    if actual:
        limiter.record_response(
            settings.agent_provider,
            settings.agent_model,
            actual,
            headers=dict(raw_response.headers),
        )

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
