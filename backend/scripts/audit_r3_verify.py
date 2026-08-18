"""Re-verify the R3 audit findings against the live system.

Every check here hits production -- PostgREST with the publishable key, the
Cloud Run service, the pooler -- rather than reading source. A finding is only
CLOSED when the system behaves differently than the audit recorded, not when
the code looks like it should.

Read-only: no writes, no DDL, no messages sent.

    poetry run python -m scripts.audit_r3_verify
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RESULTS: list[tuple[str, str, str, str]] = []  # id, verdict, expectation, evidence


def _env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (REPO / ".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip("\"'")
    return out


ENV = _env()


def http(url: str, headers: dict[str, str] | None = None, method: str = "GET", body: bytes | None = None):
    req = urllib.request.Request(url, headers=headers or {}, method=method, data=body)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def anon(path: str, profile: str | None = None) -> tuple[int, str]:
    h = {"apikey": ENV["SUPABASE_ANON_KEY"]}
    if profile:
        h["Accept-Profile"] = profile
    return http(f"{ENV['SUPABASE_URL']}/rest/v1/{path}", h)


def sql(query: str) -> str:
    """Run a read-only query through the pooler as the owner."""
    import psycopg

    from scripts.db_query import _conn_kwargs

    with psycopg.connect(**_conn_kwargs(), autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return "" if not rows else str(rows[0][0])


def record(fid: str, ok: bool, expectation: str, evidence: str) -> None:
    RESULTS.append((fid, "CLOSED" if ok else "STILL OPEN", expectation, evidence))


def main() -> int:
    # P0-01 — views ran as owner, so RLS never applied through them.
    leaks = []
    for view in ("v_entity_timeline", "people", "v_calendar_feed", "v_pipeline_status", "v_open_pending_review"):
        status, body = anon(f"{view}?select=*&limit=1")
        rows = json.loads(body) if status == 200 and body.startswith("[") else []
        if rows:
            leaks.append(view)
    record("P0-01a", not leaks, "views return no rows to anon", f"leaking: {leaks or 'none'}")

    denied = []
    for mv in ("mv_revenue_monthly", "mv_funnel_monthly", "mv_ad_roi", "mv_time_on_market", "mv_person_activity"):
        status, _ = anon(f"{mv}?select=*&limit=1")
        denied.append(status != 200)
    record("P0-01b", all(denied), "matviews deny anon", f"{sum(denied)}/5 denied")

    # P1-01 — propos_test mirror was readable with the publishable key.
    status, body = anon("audit_log?select=*&limit=1", profile="propos_test")
    record("P1-01", status != 200, "propos_test denies anon", f"http={status} {body[:60]}")

    # P1-02 — media bucket was public and enumerable.
    status, body = http(
        f"{ENV['SUPABASE_URL']}/storage/v1/object/list/media",
        {"apikey": ENV["SUPABASE_ANON_KEY"], "Content-Type": "application/json"},
        "POST",
        json.dumps({"prefix": "", "limit": 5}).encode(),
    )
    listed = json.loads(body) if status == 200 and body.startswith("[") else []
    is_public = sql("select public from storage.buckets where id='media'")
    record(
        "P1-02",
        not listed and is_public.lower() == "false",
        "bucket private, anon lists nothing",
        f"public={is_public} listed={len(listed)}",
    )

    # P1-07 — text_to_sql returned zero rows for every question.
    pol = sql("select count(*) from pg_policies where schemaname='public' and 'agent_readonly'=any(roles)")
    record("P1-07", int(pol or 0) >= 16, "agent_readonly has SELECT policies", f"{pol} policies")

    # P1-12 / P1-13 — secrets never synced, no cron jobs anywhere.
    mounted = subprocess.run(
        ["gcloud", "run", "services", "describe", "propos-api", "--region", "us-central1", "--format=json"],
        capture_output=True,
        text=True,
        check=False,
    )
    n_secrets = 0
    if mounted.returncode == 0:
        env = json.loads(mounted.stdout)["spec"]["template"]["spec"]["containers"][0]["env"]
        n_secrets = len([e for e in env if "valueFrom" in e])
    record("P1-12", n_secrets >= 13, "13 secrets mounted on the revision", f"{n_secrets} mounted")

    jobs = subprocess.run(
        ["gcloud", "scheduler", "jobs", "list", "--location=us-central1", "--format=value(name)"],
        capture_output=True,
        text=True,
        check=False,
    )
    n_jobs = len([j for j in jobs.stdout.split("\n") if j.strip()])
    record("P1-13", n_jobs >= 2, "scheduler jobs exist in us-central1", f"{n_jobs} jobs")

    # P1-19 / P2-04 / P2-10 — SECURITY DEFINER grants, deletable audit log, unguarded webhook table.
    ex = sql(
        "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
        "where n.nspname='public' and p.proname in ('set_agent_context','refresh_analytics') "
        "and (has_function_privilege('authenticated', p.oid, 'EXECUTE') "
        "  or has_function_privilege('anon', p.oid, 'EXECUTE'))"
    )
    record("P1-19", ex == "0", "definer functions revoked from anon/authenticated", f"{ex} still granted")

    dele = sql("select count(*) from pg_policies where tablename='audit_log' and cmd='DELETE'")
    record("P2-04", dele == "0", "audit_log has no DELETE policy", f"{dele} delete policies")

    rls = sql(
        "select c.relrowsecurity::text from pg_class c join pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='public' and c.relname='kapso_webhook_events'"
    )
    record("P2-10", rls.lower() == "true", "kapso_webhook_events has RLS", f"relrowsecurity={rls}")

    # P2-44 — /health was a constant, used as the deploy gate.
    url = subprocess.run(
        [
            "gcloud",
            "run",
            "services",
            "describe",
            "propos-api",
            "--region",
            "us-central1",
            "--format=value(status.url)",
        ],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()
    status, body = http(f"{url}/health/ready")
    record(
        "P2-44",
        status == 200 and "database" in body,
        "/health/ready checks real dependencies",
        f"http={status} {body[:70]}",
    )

    # P1-12 (second half) — internal jobs answered 503 because no secret was mounted.
    status, _ = http(f"{url}/api/v1/internal/jobs/run-due-reminders", {"X-Internal-Key": "wrong"}, "POST", b"")
    record("P1-12b", status == 403, "internal jobs reject a bad key with 403, not 503", f"http={status}")

    width = max(len(r[2]) for r in RESULTS)
    print(f"\n{'ID':<10} {'VERDICT':<11} {'EXPECTATION':<{width}}  EVIDENCE")
    print("-" * (26 + width + 40))
    for fid, verdict, expectation, evidence in RESULTS:
        print(f"{fid:<10} {verdict:<11} {expectation:<{width}}  {evidence}")

    open_count = sum(1 for r in RESULTS if r[1] != "CLOSED")
    print(f"\n{len(RESULTS) - open_count}/{len(RESULTS)} verified closed against the live system")
    return 1 if open_count else 0


if __name__ == "__main__":
    sys.exit(main())
