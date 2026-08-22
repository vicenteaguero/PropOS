"""Backfill thumbnails for existing document_versions rows that lack one.

Iterates document_versions joined to documents, downloads the raw blob,
renders a WebP thumbnail (PDF first page or resized raster image), uploads
to the same `{tenant}/4_thumbnails/{doc_id}/v{n}.webp` scheme, and writes
`document_versions.thumbnail_path`.

Usage:
    poetry run python -m scripts.backfill_thumbnails
    poetry run python -m scripts.backfill_thumbnails --dry-run
    poetry run python -m scripts.backfill_thumbnails --limit 50
    poetry run python -m scripts.backfill_thumbnails --mime image
    poetry run python -m scripts.backfill_thumbnails --mime pdf
    poetry run python -m scripts.backfill_thumbnails --all-versions

By default only each document's CURRENT version is rendered. Historical
versions are reachable only from the version drawer, which does not show
thumbnails, so rendering v1..v6 of every document costs storage and minutes
for pixels nothing displays.

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
from app.features.documents.service import THUMB_READY, THUMB_UNSUPPORTED, _persist_thumbnail_result
from app.features.documents.thumbnails import (
    SUPPORTED_IMAGE_MIMES,
    THUMBNAIL_MIME,
    generate_first_page_png,
    generate_image_thumbnail,
    thumbnail_path as build_thumbnail_path,
)

VERSIONS_TABLE = "document_versions"
DOCUMENTS_TABLE = "documents"


# PostgREST caps a response at 1000 rows and reports no error when it truncates,
# so every unbounded read here is a silent partial result. Paging explicitly is
# the only way a backfill can claim it covered the table.
PAGE = 1000
# `in_` is a URL filter, so a chunk that is too large is rejected by the proxy
# long before PostgREST sees it.
CHUNK = 200


def _page_all(build_query, limit: int | None) -> list[dict]:
    """Read a query to exhaustion, `PAGE` rows at a time."""
    out: list[dict] = []
    offset = 0
    while True:
        want = PAGE if limit is None else min(PAGE, limit - len(out))
        if want <= 0:
            break
        rows = build_query().range(offset, offset + want - 1).execute().data or []
        out.extend(rows)
        if len(rows) < want:
            break
        offset += len(rows)
    return out


def _chunked(values: list, size: int = CHUNK):
    for i in range(0, len(values), size):
        yield values[i : i + size]


def _mime_filtered(q, mime_filter: str):
    if mime_filter == "pdf":
        return q.eq("mime_type", "application/pdf")
    if mime_filter == "image":
        return q.like("mime_type", "image/%")
    # mime == "all": no filter; we skip unknown mimes per row.
    return q


def _iter_versions(mime_filter: str, limit: int | None, current_only: bool) -> list[dict]:
    """Return rows {id, version_number, mime_type, raw_path, document_id, tenant_id} needing thumbnails."""
    client = get_supabase_client()

    if current_only:
        docs = _page_all(
            lambda: client.table(DOCUMENTS_TABLE)
            .select("id, tenant_id, current_version_id")
            .not_.is_("current_version_id", "null")
            .is_("deleted_at", "null")
            .order("id"),
            None,
        )
        tenant_by_doc = {d["id"]: d["tenant_id"] for d in docs}
        current_ids = [d["current_version_id"] for d in docs if d.get("current_version_id")]
        versions: list[dict] = []
        for chunk in _chunked(current_ids):
            versions.extend(
                _mime_filtered(
                    client.table(VERSIONS_TABLE)
                    .select("id, version_number, mime_type, raw_path, document_id, thumbnail_path")
                    .is_("thumbnail_path", "null")
                    .in_("id", chunk),
                    mime_filter,
                )
                .execute()
                .data
                or []
            )
            if limit and len(versions) >= limit:
                versions = versions[:limit]
                break
    else:
        versions = _page_all(
            lambda: _mime_filtered(
                client.table(VERSIONS_TABLE)
                .select("id, version_number, mime_type, raw_path, document_id, thumbnail_path")
                .is_("thumbnail_path", "null"),
                mime_filter,
            ).order("id"),
            limit,
        )
        doc_ids = list({v["document_id"] for v in versions})
        tenant_by_doc = {}
        for chunk in _chunked(doc_ids):
            rows = client.table(DOCUMENTS_TABLE).select("id, tenant_id").in_("id", chunk).execute().data or []
            tenant_by_doc.update({d["id"]: d["tenant_id"] for d in rows})

    if not versions:
        return []

    out: list[dict] = []
    orphaned = 0
    for v in versions:
        tenant_id = tenant_by_doc.get(v["document_id"])
        if not tenant_id:
            orphaned += 1
            continue
        out.append({**v, "tenant_id": tenant_id})
    if orphaned:
        # Loud, because this used to be how a truncated tenant lookup disappeared.
        print(f"WARNING: {orphaned} version(s) skipped, no parent document row resolved")
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
            if not dry_run:
                _persist_thumbnail_result(client, row["id"], None, THUMB_UNSUPPORTED)
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
            storage.upload_object(target, png, THUMBNAIL_MIME)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"{prefix} - upload FAILED: {exc}")
            continue
        try:
            # Through the service helper so `thumbnail_state` lands too. Writing
            # only the path leaves every backfilled row reading PENDING, which
            # makes the pending index useless and misreports coverage.
            _persist_thumbnail_result(client, row["id"], target, THUMB_READY)
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
    parser.add_argument(
        "--all-versions",
        action="store_true",
        help="Also render historical versions (default: current version only)",
    )
    args = parser.parse_args(argv)

    rows = _iter_versions(args.mime, args.limit, current_only=not args.all_versions)
    if not rows:
        print("No versions need thumbnails for filter:", args.mime)
        return 0

    scope = "all versions" if args.all_versions else "current versions"
    print(f"Processing {len(rows)} version(s) (dry_run={args.dry_run}, mime={args.mime}, scope={scope})")
    ok, failed, skipped = _process(rows, dry_run=args.dry_run)
    print()
    print(f"Done. ok={ok} failed={failed} skipped={skipped} total={ok + failed + skipped}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
