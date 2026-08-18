"""The audit trigger's side of agent attribution (P2-54).

`tests/test_audit_stamping.py` proves `accept_proposal` puts
`X-Agent-Session-Id` / `X-Action-Source` on the request. That is only half the
claim: it matters because `log_audit()` reads those headers out of
`request.headers` and writes them into `audit_log.agent_session_id` /
`audit_log.source`. This suite asserts that second half against the real
trigger, so a migration that rewrites `log_audit()` and drops the header
fallback fails here instead of in production.

Same rules as `test_cross_tenant.py`: production DB, `_xtest_` markers,
rollback after every test, never commit.

Run with:
    poetry run pytest tests/integration/test_audit_stamping.py -m integration -v
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Generator

import psycopg
import pytest

from scripts.db_query import _conn_kwargs


def _has_db() -> bool:
    try:
        _conn_kwargs()
        return True
    except SystemExit:
        return False


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _has_db(), reason="DB env missing"),
]


@pytest.fixture(scope="module")
def conn() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(**_conn_kwargs()) as c:
        yield c
        c.rollback()


@pytest.fixture
def cur(conn: psycopg.Connection) -> Generator[psycopg.Cursor, None, None]:
    with conn.cursor() as c:
        yield c
        conn.rollback()


@pytest.fixture
def tenant_id(cur: psycopg.Cursor) -> str:
    cur.execute("SELECT id FROM tenants ORDER BY created_at, id LIMIT 1")
    row = cur.fetchone()
    if not row:
        pytest.skip("no tenants — seed not run")
    return str(row[0])


def _set_request_headers(cur: psycopg.Cursor, headers: dict[str, str]) -> None:
    """Mimic PostgREST: expose the request headers as a GUC the trigger reads."""
    cur.execute("SELECT set_config('request.headers', %s, true)", (json.dumps(headers),))


def _insert_property(cur: psycopg.Cursor, tenant_id: str) -> str:
    row_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO properties (id, tenant_id, title) VALUES (%s, %s, %s)",
        (row_id, tenant_id, f"_xtest_audit_{uuid.uuid4().hex[:8]}"),
    )
    return row_id


def _audit_row(cur: psycopg.Cursor, row_id: str) -> tuple[str, str | None]:
    cur.execute(
        "SELECT source, agent_session_id FROM audit_log WHERE table_name = 'properties' AND row_id = %s",
        (row_id,),
    )
    rows = cur.fetchall()
    assert len(rows) == 1, f"expected exactly one audit row for {row_id}, got {len(rows)}"
    source, session_id = rows[0]
    return source, (str(session_id) if session_id else None)


def test_agent_headers_produce_agent_attribution(cur: psycopg.Cursor, tenant_id: str) -> None:
    """The two headers `accept_proposal` sets must land in `audit_log`."""
    session_id = str(uuid.uuid4())
    _set_request_headers(
        cur,
        {"x-agent-session-id": session_id, "x-action-source": "agent"},
    )

    row_id = _insert_property(cur, tenant_id)

    source, logged_session = _audit_row(cur, row_id)
    assert source == "agent", f"agent write recorded as source={source!r}"
    assert logged_session == session_id, f"agent session not recorded: {logged_session!r}"


def test_writes_without_headers_are_attributed_to_the_user(cur: psycopg.Cursor, tenant_id: str) -> None:
    """The control: a plain write must NOT be labelled 'agent'.

    Without this, a trigger that hardcoded source='agent' would pass the test
    above while destroying the distinction the audit log exists to record.
    """
    _set_request_headers(cur, {})

    row_id = _insert_property(cur, tenant_id)

    source, logged_session = _audit_row(cur, row_id)
    assert source == "user", f"unattributed write recorded as source={source!r}"
    assert logged_session is None, f"unattributed write carries a session id: {logged_session!r}"


def test_guc_context_beats_missing_headers(cur: psycopg.Cursor, tenant_id: str) -> None:
    """`set_agent_context()` is the other supported entry point (SET LOCAL path)."""
    session_id = str(uuid.uuid4())
    cur.execute("SELECT set_config('app.agent_session_id', %s, true)", (session_id,))
    cur.execute("SELECT set_config('app.action_source', %s, true)", ("agent",))

    row_id = _insert_property(cur, tenant_id)

    source, logged_session = _audit_row(cur, row_id)
    assert source == "agent"
    assert logged_session == session_id


def test_updates_and_deletes_are_attributed_too(cur: psycopg.Cursor, tenant_id: str) -> None:
    """Attribution must survive the whole lifecycle, not just INSERT."""
    row_id = _insert_property(cur, tenant_id)

    session_id = str(uuid.uuid4())
    _set_request_headers(cur, {"x-agent-session-id": session_id, "x-action-source": "agent"})
    cur.execute("UPDATE properties SET title = %s WHERE id = %s", ("_xtest_audit_updated", row_id))
    cur.execute("DELETE FROM properties WHERE id = %s", (row_id,))

    cur.execute(
        "SELECT op, source, agent_session_id FROM audit_log "
        "WHERE table_name = 'properties' AND row_id = %s ORDER BY changed_at",
        (row_id,),
    )
    rows = cur.fetchall()
    by_op = {r[0]: (r[1], str(r[2]) if r[2] else None) for r in rows}
    assert "UPDATE" in by_op and "DELETE" in by_op, f"missing audit rows: {sorted(by_op)}"
    for op in ("UPDATE", "DELETE"):
        source, logged_session = by_op[op]
        assert source == "agent", f"{op} recorded as source={source!r}"
        assert logged_session == session_id, f"{op} lost the session id: {logged_session!r}"


def test_audit_row_captures_the_tenant(cur: psycopg.Cursor, tenant_id: str) -> None:
    """Audit rows are tenant-scoped; a null tenant makes recovery unusable."""
    _set_request_headers(cur, {"x-agent-session-id": str(uuid.uuid4()), "x-action-source": "agent"})

    row_id = _insert_property(cur, tenant_id)

    cur.execute(
        "SELECT tenant_id, op, after IS NOT NULL FROM audit_log WHERE table_name = 'properties' AND row_id = %s",
        (row_id,),
    )
    logged_tenant, op, has_after = cur.fetchone()
    assert str(logged_tenant) == tenant_id
    assert op == "INSERT"
    assert has_after, "audit row has no `after` snapshot — nothing to replay"
