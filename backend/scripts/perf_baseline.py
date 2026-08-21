"""Latency probe for the endpoints a broker actually waits on.

The point is comparison, not absolute numbers: run it before a performance
change and again after, against the same deployment, and read the delta. A p50
that moved 600 ms is an argument; a p50 of 900 ms on its own is a number.

Usage:
    export PROPOS_API_URL=https://propos-api-....run.app
    export PROPOS_ACCESS_TOKEN=<a Supabase access_token>
    export PROPOS_TENANT_ID=<uuid>            # optional, sent as X-Tenant-Id
    poetry run python -m scripts.perf_baseline
    poetry run python -m scripts.perf_baseline --runs 20 --label post-1.1

Get a token from the browser: the app stores the Supabase session under the
`sb-<project-ref>-auth-token` key in localStorage; `access_token` is inside.
They expire in an hour, so grab a fresh one per run.

`/health` is included on purpose as the control: it touches nothing, so it
measures the floor (network + Cloud Run) that every other row sits on top of.
Anything above that floor is work the API is doing, which is the part a code
change can move.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import urllib.error
import urllib.request

# Path, plus whether it needs a bearer token. The unauthenticated rows are the
# control group: they skip the auth dependency chain entirely, so the gap
# between them and everything else IS the per-request auth cost.
ENDPOINTS: list[tuple[str, bool]] = [
    ("/health", False),
    ("/api/v1/analytics/pending-count", True),
    ("/api/v1/contacts?limit=100", True),
    ("/api/v1/attention?limit=20", True),
    ("/api/v1/events/calendar", True),
    ("/api/v1/opportunities?limit=100", True),
]

DEFAULT_RUNS = 10
TIMEOUT_SECONDS = 30


def _percentile(values: list[float], pct: float) -> float:
    """Nearest-rank percentile. Deliberately not interpolating: with 10 samples
    an interpolated p95 invents a number that no request actually took."""
    if not values:
        return float("nan")
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(pct / 100 * len(ordered) + 0.5)) - 1)
    return ordered[max(index, 0)]


def _probe(url: str, headers: dict[str, str]) -> tuple[float, int]:
    request = urllib.request.Request(url, headers=headers)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        exc.read()
        status = exc.code
    except Exception:  # noqa: BLE001 - a dead endpoint is a data point, not a crash
        return (time.perf_counter() - start) * 1000, 0
    return (time.perf_counter() - start) * 1000, status


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=DEFAULT_RUNS)
    parser.add_argument("--label", default="baseline", help="printed in the header")
    args = parser.parse_args()

    base = os.environ.get("PROPOS_API_URL", "").rstrip("/")
    if not base:
        raise SystemExit("PROPOS_API_URL is not set")
    token = os.environ.get("PROPOS_ACCESS_TOKEN", "")
    tenant = os.environ.get("PROPOS_TENANT_ID", "")
    if not token:
        print("warning: PROPOS_ACCESS_TOKEN is not set — authenticated rows will 401", file=sys.stderr)

    auth_headers = {"Authorization": f"Bearer {token}"}
    if tenant:
        # The header the frontend always sends, and the reason resolve_active_tenant
        # used to write on every request. Send it, or the probe measures a path
        # no real client takes.
        auth_headers["X-Tenant-Id"] = tenant

    print(f"# perf baseline · {args.label} · {args.runs} runs · {base}")
    print(f"{'endpoint':<42} {'p50':>9} {'p95':>9} {'min':>9} {'status':>7}")

    results: dict[str, dict[str, float]] = {}
    for path, needs_auth in ENDPOINTS:
        headers = auth_headers if needs_auth else {}
        # One warm-up: the first call absorbs the Cloud Run cold start and the
        # TLS handshake, which would otherwise dominate a 10-sample p95.
        _probe(base + path, headers)
        samples: list[float] = []
        status = 0
        for _ in range(args.runs):
            elapsed, status = _probe(base + path, headers)
            samples.append(elapsed)
        row = {
            "p50": statistics.median(samples),
            "p95": _percentile(samples, 95),
            "min": min(samples),
            "status": float(status),
        }
        results[path] = row
        print(f"{path:<42} {row['p50']:>8.0f}ms {row['p95']:>8.0f}ms {row['min']:>8.0f}ms {status:>7}")

    print()
    print(json.dumps({"label": args.label, "runs": args.runs, "results": results}, indent=2))


if __name__ == "__main__":
    main()
