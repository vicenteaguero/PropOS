"""Aggregate `tests/integration/anita/results.jsonl` into a Markdown table.

Usage: poetry run python scripts/anita_results_report.py
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

RESULTS = Path(__file__).parent.parent / "tests" / "integration" / "anita" / "results.jsonl"


def main() -> None:
    if not RESULTS.exists():
        print(f"no results file at {RESULTS}; run `make test-anita` first")
        return

    by_test: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for line in RESULTS.read_text().splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        by_test[(rec["test"], rec["provider"])].append(rec)

    print("| Test | Provider | Pass | Avg latency (ms) | Tokens (in/out) |")
    print("|---|---|---|---|---|")
    for (test, provider), records in sorted(by_test.items()):
        passes = sum(1 for r in records if r.get("pass"))
        n = len(records)
        avg_latency = (
            sum(r.get("latency_ms", 0) for r in records) // n if n else 0
        )
        toks_in = sum((r.get("tokens", {}) or {}).get("in", 0) or 0 for r in records)
        toks_out = sum((r.get("tokens", {}) or {}).get("out", 0) or 0 for r in records)
        print(
            f"| {test} | {provider} | {passes}/{n} | {avg_latency} | {toks_in}/{toks_out} |"
        )


if __name__ == "__main__":
    main()
