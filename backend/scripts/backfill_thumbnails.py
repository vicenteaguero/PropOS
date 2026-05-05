"""Backfill thumbnails for existing document_versions rows that lack one.

Iterates document_versions joined to documents, downloads the raw blob,
renders a PNG thumbnail (PDF first page or resized raster image), uploads
to the same `{tenant}/4_thumbnails/{doc_id}/v{n}.png` scheme, and writes
`document_versions.thumbnail_path`.

Usage:
    poetry run python -m scripts.backfill_thumbnails
    poetry run python -m scripts.backfill_thumbnails --dry-run
    poetry run python -m scripts.backfill_thumbnails --limit 50
    poetry run python -m scripts.backfill_thumbnails --mime image
    poetry run python -m scripts.backfill_thumbnails --mime pdf

Run interactively. Prints progress per row, summary at end. Uses the same
Supabase admin client + storage helpers as the documents service so storage
paths and auth are consistent.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterable

from app.core.supabase.client import get_supabase_client
from app.features.documents import storage
from app.features.documents.thumbnails import (
    SUPPORTED_IMAGE_MIMES,
    generate_first_page_png,
    generate_image_thumbnail,
    thumbnail_path as build_thumbnail_path,
)

VERSIONS_TABLE = "document_versions"
DOCUMENTS_TABLE = "documents"


def _iter_versions(mime_filter: str, limit: int | None) -> list[dict]:
    """Return rows {id, version_number, mime_type, raw_path, document_id, tenant_id} needing thumbnails."""
    client = get_supabase_client()
    # Pull versions without thumbnail; resolve tenant via documents.
    q = (
        client.table(VERSIONS_TABLE)
        .select("id, version_number, mime_type, raw_path, document_id, thumbnail_path")
        .is_("thumbnail_path", "null")
    )
    if mime_filter == "pdf":
        q = q.eq("mime_type", "application/pdf")
    elif mime_filter == "image":
        q = q.like("mime_type", "image/%")
    # mime == "all": no filter; we'll skip unknown mimes per row.
    if limit:
        q = q.limit(limit)
    versions = q.execute().data or []
    if not versions:
        return []

    doc_ids = list({v["document_id"] for v in versions})
    docs = client.table(DOCUMENTS_TABLE).select("id, tenant_id").in_("id", doc_ids).execute().data or []
    tenant_by_doc = {d["id"]: d["tenant_id"] for d in docs}
    out: list[dict] = []
    for v in versions:
        tenant_id = tenant_by_doc.get(v["document_id"])
        if not tenant_id:
            continue
        out.append({**v, "tenant_id": tenant_id})
    return out


def _supported(mime: str) -> bool:
    return mime == "application/pdf" or mime in SUPPORTED_IMAGE_MIMES


def _render(mime: str, blob: bytes) -> bytes:
    if mime == "application/pdf":
        return generate_first_page_png(blob)
    return generate_image_thumbnail(blob, mime)


def _process(rows: Iterable[dict], dry_run: bool) -> tuple[int, int, int]:
    client = get_supabase_client()
    total = ok = failed = skipped = 0
    rows_list = list(rows)
    grand = len(rows_list)
    for idx, row in enumerate(rows_list, start=1):
        total += 1
        mime = row.get("mime_type") or ""
        doc_id = row["document_id"]
        ver_n = row["version_number"]
        tenant_id = row["tenant_id"]
        prefix = f"[{idx}/{grand}] {doc_id} v{ver_n} {mime}"

        if not _supported(mime):
            skipped += 1
            print(f"{prefix} - skip (unsupported mime)")
            continue
        raw = row.get("raw_path")
        if not raw:
            skipped += 1
            print(f"{prefix} - skip (no raw_path)")
            continue
        try:
            blob = storage.download_object(raw)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"{prefix} - download FAILED: {exc}")
            continue
        try:
            png = _render(mime, blob)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"{prefix} - render FAILED: {exc}")
            continue

        target = build_thumbnail_path(tenant_id, doc_id, ver_n)
        if dry_run:
            ok += 1
            print(f"{prefix} OK (dry-run, {len(png)}B → {target})")
            continue
        try:
            storage.upload_object(target, png, "image/png")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"{prefix} - upload FAILED: {exc}")
            continue
        try:
            client.table(VERSIONS_TABLE).update({"thumbnail_path": target}).eq("id", row["id"]).execute()
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"{prefix} - db update FAILED: {exc}")
            continue
        ok += 1
        print(f"{prefix} OK")

    return ok, failed, skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Render but don't upload or persist")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to process")
    parser.add_argument(
        "--mime",
        choices=["pdf", "image", "all"],
        default="all",
        help="Filter by mime category (default: all)",
    )
    args = parser.parse_args(argv)

    rows = _iter_versions(args.mime, args.limit)
    if not rows:
        print("No versions need thumbnails for filter:", args.mime)
        return 0

    print(f"Processing {len(rows)} version(s) (dry_run={args.dry_run}, mime={args.mime})")
    ok, failed, skipped = _process(rows, dry_run=args.dry_run)
    print()
    print(f"Done. ok={ok} failed={failed} skipped={skipped} total={ok + failed + skipped}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
