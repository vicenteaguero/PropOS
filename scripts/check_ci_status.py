#!/usr/bin/env python3
"""Block a deploy until GitHub Actions has gone green for a commit.

Cloud Build's `propos-api-deploy` trigger fires on push to `main` on its own,
with no dependency on GitHub Actions, so a commit that broke the suite still
built an image and ran `gcloud run deploy`. Branch protection is the usual fix
and needs repo-admin rights; this closes the same hole from inside the pipeline,
which is where the deploy actually happens.

The repository is public, so the Checks API answers unauthenticated — no token,
no secret, no extra IAM. Anonymous GitHub API calls are limited to 60/hour per
IP; one deploy uses a handful of polls, well inside that.

Exit codes: 0 = every required check succeeded (or the gate does not apply),
1 = a required check failed, timed out, or GitHub could not be reached.

    python3 scripts/check_ci_status.py --repo owner/name --sha <sha>
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

# Job names as GitHub reports them, from `.github/workflows/ci.yml`. Renaming a
# job there without renaming it here turns the gate off silently, so the script
# treats an absent check as "not finished" and eventually times out rather than
# passing.
REQUIRED_CHECKS = (
    "Backend (ruff + pytest)",
    "Frontend (eslint + prettier + tsc + build)",
    "Migrations (naming + ordering)",
)

# Conclusions that are not a pass. `skipped` counts as a failure for a required
# check: a job that did not run has verified nothing.
FAILING = {"failure", "timed_out", "cancelled", "action_required", "stale", "skipped"}


def fetch_check_runs(repo: str, sha: str) -> list[dict]:
    url = f"https://api.github.com/repos/{repo}/commits/{sha}/check-runs?per_page=100"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "propos-deploy-gate",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - fixed https host
        payload = json.load(response)
    return payload.get("check_runs", [])


def evaluate(runs: list[dict]) -> tuple[str, str]:
    """Return (state, message) where state is ok | failed | pending."""
    by_name: dict[str, list[dict]] = {}
    for run in runs:
        by_name.setdefault(run.get("name", ""), []).append(run)

    pending: list[str] = []
    failed: list[str] = []

    for name in REQUIRED_CHECKS:
        matches = by_name.get(name, [])
        if not matches:
            pending.append(f"{name} (not reported yet)")
            continue
        # A name can appear twice — once for the push, once for the PR. Both
        # have to be green; either still running means keep waiting.
        for run in matches:
            if run.get("status") != "completed":
                pending.append(f"{name} ({run.get('status')})")
            elif run.get("conclusion") in FAILING:
                failed.append(f"{name} -> {run.get('conclusion')}")

    if failed:
        return "failed", "; ".join(sorted(set(failed)))
    if pending:
        return "pending", "; ".join(sorted(set(pending)))
    return "ok", "; ".join(REQUIRED_CHECKS)


def wait_for_ci(repo: str, sha: str, timeout: int, interval: int) -> int:
    deadline = time.monotonic() + timeout
    unreachable = 0

    while True:
        try:
            runs = fetch_check_runs(repo, sha)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            unreachable += 1
            print(f"github api unreachable ({exc}) — retry {unreachable}", flush=True)
            # Fail closed. An unverifiable CI status is not a green one; use
            # _SKIP_CI_GATE=true for a deliberate emergency deploy.
            if unreachable >= 5:
                print("could not reach the GitHub Checks API — refusing to deploy unverified", file=sys.stderr)
                return 1
            runs = []
        else:
            unreachable = 0

        state, message = evaluate(runs)
        if state == "ok":
            print(f"CI green for {sha[:7]}: {message}")
            return 0
        if state == "failed":
            print(f"CI is RED for {sha[:7]}: {message}", file=sys.stderr)
            print("Deploy blocked. Fix the run, then push again.", file=sys.stderr)
            return 1

        if time.monotonic() >= deadline:
            print(f"timed out after {timeout}s waiting for CI on {sha[:7]}: {message}", file=sys.stderr)
            return 1
        print(f"waiting for CI on {sha[:7]}: {message}", flush=True)
        time.sleep(interval)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="owner/name")
    parser.add_argument("--sha", default="", help="commit SHA; empty means a manual build")
    parser.add_argument("--timeout", type=int, default=900, help="seconds to wait for CI to finish")
    parser.add_argument("--interval", type=int, default=20, help="seconds between polls")
    args = parser.parse_args()

    if not args.sha:
        # `gcloud builds submit` has no commit, so there is no CI run to check.
        # The developer running it locally is the gate in that case.
        print("no commit SHA (manual build) — CI gate does not apply")
        return 0

    return wait_for_ci(args.repo, args.sha, args.timeout, args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
