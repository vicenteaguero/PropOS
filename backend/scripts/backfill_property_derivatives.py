"""Backfill WebP derivatives for property photos uploaded before they existed.

`features/properties/photos.py` writes a `thumb` (~400px) and a `card` (~800px)
WebP beside every original at upload time, and every consumer falls back to the
full-resolution original when a derivative is missing. That fallback is what
makes this script optional rather than a migration — but it also means the
demo tenant's 243 photos each ship several megabytes to a grid thumbnail until
this has run.

Storage is the only record of which derivatives exist (their paths are derived
from the original's), so "already done" is decided by asking Storage to sign
them: a path that signs is a derivative that is there.

Usage:
    poetry run python -m scripts.backfill_property_derivatives --dry-run
    poetry run python -m scripts.backfill_property_derivatives
    poetry run python -m scripts.backfill_property_derivatives --limit 20
    poetry run python -m scripts.backfill_property_derivatives --force

Writes are guarded by tenant id exactly like the demo seed: the script refuses
to touch anything but `--tenant`, which defaults to the demo tenant. This runs
against `public`, the schema production serves, so treat the guard as
load-bearing.
"""

from __future__ import annotations

import argparse
import sys

from app.core.supabase.client import get_supabase_client
from app.features.properties.photos import (
    DERIVATIVE_SIZES,
    MEDIA_ASSETS,
    MEDIA_BUCKET,
    MEDIA_FILES,
    TARGET_TABLE,
    build_derivatives,
    derivative_path,
    sign_many,
    storage_path_from_url,
)
from scripts.seed_demo.context import DEMO_TENANT_ID, SeedAbortError, assert_safe_to_write

# Storage's batch sign endpoint takes a list; keep each request small enough
# that one unlucky page does not time out the whole run.
SIGN_CHUNK = 100


def _originals(tenant_id: str, limit: int | None) -> list[str]:
    """Object paths of every property photo in the tenant, oldest position first."""
    client = get_supabase_client()
    assets = (
        client.table(MEDIA_ASSETS)
        .select("media_file_id")
        .eq("tenant_id", tenant_id)
        .eq("target_table", TARGET_TABLE)
        .execute()
        .data
        or []
    )
    file_ids = list(dict.fromkeys(a["media_file_id"] for a in assets))
    if not file_ids:
        return []

    paths: list[str] = []
    # PostgREST puts the filter in the URL, so an unbounded `in_` on hundreds of
    # ids is a request long enough to be rejected. Page it.
    for start in range(0, len(file_ids), 200):
        rows = (
            client.table(MEDIA_FILES)
            .select("id, url, deleted_at")
            .in_("id", file_ids[start : start + 200])
            .eq("tenant_id", tenant_id)
            .execute()
            .data
            or []
        )
        for row in rows:
            if row.get("deleted_at"):
                continue
            path = storage_path_from_url(row.get("url"))
            # External media (URLs we did not upload) has no object to resize.
            if path:
                paths.append(path)

    paths = list(dict.fromkeys(paths))
    return paths[:limit] if limit else paths


def _missing(paths: list[str]) -> list[str]:
    """Originals for which at least one derivative does not yet exist."""
    wanted = [derivative_path(p, v) for p in paths for v in DERIVATIVE_SIZES]
    present: set[str] = set()
    for start in range(0, len(wanted), SIGN_CHUNK):
        present.update(sign_many(wanted[start : start + SIGN_CHUNK], expires_in=60))
    return [p for p in paths if any(derivative_path(p, v) not in present for v in DERIVATIVE_SIZES)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate WebP derivatives for existing property photos")
    parser.add_argument("--tenant", default=DEMO_TENANT_ID, help="tenant id to backfill (guarded)")
    parser.add_argument("--limit", type=int, default=None, help="stop after N originals")
    parser.add_argument("--dry-run", action="store_true", help="report what would be generated")
    parser.add_argument("--force", action="store_true", help="regenerate even when derivatives exist")
    args = parser.parse_args(argv)

    try:
        assert_safe_to_write(args.tenant)
    except SeedAbortError as exc:
        print(f"aborted: {exc}")
        return 2

    paths = _originals(args.tenant, args.limit)
    if not paths:
        print("no property photos found for this tenant")
        return 0

    todo = paths if args.force else _missing(paths)
    print(f"{len(paths)} originals, {len(todo)} needing derivatives")
    if args.dry_run:
        for path in todo[:20]:
            print(f"  would generate: {path}")
        if len(todo) > 20:
            print(f"  … and {len(todo) - 20} more")
        return 0

    client = get_supabase_client()
    done = 0
    failed = 0
    for index, path in enumerate(todo, start=1):
        try:
            content = client.storage.from_(MEDIA_BUCKET).download(path)
            variants = build_derivatives(content)
            if not variants:
                raise ValueError("unreadable image")
            for variant, data in variants.items():
                client.storage.from_(MEDIA_BUCKET).upload(
                    path=derivative_path(path, variant),
                    file=data,
                    file_options={"content-type": "image/webp", "upsert": "true"},
                )
            done += 1
            print(f"[{index}/{len(todo)}] {path} → {', '.join(sorted(variants))}")
        except Exception as exc:  # noqa: BLE001 — one bad object must not end the run
            failed += 1
            print(f"[{index}/{len(todo)}] {path} FAILED: {str(exc)[:160]}")

    print(f"done: {done} generated, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
