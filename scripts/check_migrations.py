#!/usr/bin/env python3
"""Static checks over `supabase/migrations/`.

Migrations are the only mechanism for schema change, and nothing verified them
until `make migrate` ran against the live database — by which point a duplicate
sequence number or an unterminated dollar-quoted body is a production incident,
not a review comment.

Deliberately does *not* execute the SQL. Applying these files needs a Supabase
instance (`auth.uid()`, `storage.objects`, the `authenticated`/`anon` roles), and
parsing them with sqlglot reports four false positives on valid Postgres today
(`COMMENT ON COLUMN ... IS '...'`). So this checks the properties that can be
verified with certainty, and stays quiet about the rest.

    python scripts/check_migrations.py [--dir supabase/migrations]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

# 20240601000042_kapso_channels.sql — 14-digit stamp, snake_case name.
NAME_RE = re.compile(r"^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$")

# `$$ ... $$` and `$tag$ ... $tag$` bodies, which is how every function and
# trigger in this repo is written. An odd count means the body never closed and
# psql will swallow the rest of the file.
DOLLAR_QUOTE_RE = re.compile(r"\$([a-z_]*)\$")


def check(directory: Path) -> list[str]:
    errors: list[str] = []

    if not directory.is_dir():
        return [f"{directory} is not a directory"]

    stray = sorted(p.name for p in directory.iterdir() if p.is_file() and p.suffix != ".sql")
    for name in stray:
        errors.append(f"{name}: not a .sql file — migrations directory takes SQL only")

    files = sorted(p for p in directory.glob("*.sql"))
    if not files:
        return ["no migrations found"]

    by_stamp: dict[str, list[str]] = defaultdict(list)

    for path in files:
        match = NAME_RE.match(path.name)
        if not match:
            errors.append(f"{path.name}: expected <14-digit-stamp>_<snake_case>.sql")
            continue
        by_stamp[match.group(1)].append(path.name)

        body = path.read_text()
        if not body.strip():
            errors.append(f"{path.name}: empty")
            continue

        tags: dict[str, int] = defaultdict(int)
        for tag in DOLLAR_QUOTE_RE.findall(body):
            tags[tag] += 1
        for tag, count in tags.items():
            if count % 2:
                label = f"${tag}$" if tag else "$$"
                errors.append(f"{path.name}: unbalanced {label} quoting ({count} markers)")

    # Two files with the same stamp apply in an order that depends on the
    # filesystem, which is the classic "worked locally, broke in prod" bug.
    for stamp, names in sorted(by_stamp.items()):
        if len(names) > 1:
            errors.append(f"duplicate sequence {stamp}: {', '.join(sorted(names))}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dir",
        default=Path(__file__).resolve().parents[1] / "supabase" / "migrations",
        type=Path,
    )
    args = parser.parse_args()

    errors = check(args.dir)
    if errors:
        print(f"{len(errors)} problem(s) in {args.dir}:", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        return 1

    count = len(list(args.dir.glob("*.sql")))
    print(f"{count} migrations OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
