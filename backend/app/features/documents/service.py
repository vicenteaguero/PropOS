from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import HTTPException, status

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.documents import storage
from app.features.documents.hashing import sha256_hex
from app.features.documents.metadata import extract_pdf_metadata, strip_pdf_metadata
from app.features.documents.stubs.scan import scan_file
from app.features.documents.thumbnails import (
    generate_first_page_png,
    generate_image_thumbnail,
    thumbnail_path as build_thumbnail_path,
)
from app.features.documents.validation import (
    kind_from_mime,
    validate_upload,
)
from datetime import UTC

DOCUMENTS_TABLE = "documents"
VERSIONS_TABLE = "document_versions"
ASSIGNMENTS_TABLE = "document_assignments"

logger = get_logger("DOCUMENTS")


def _maybe_generate_thumbnail(
    *,
    mime: str,
    pdf_bytes: bytes,
    tenant_id: str,
    document_id: str,
    version_id: str,
    version_number: int,
) -> str | None:
    """Render + upload PNG thumb (PDF first page or raster image). Best-effort; logs and swallows failures.

    The ``pdf_bytes`` parameter holds the raw bytes regardless of mime — the name is kept
    for backwards compatibility with existing call sites.

    Returns the storage path on success, None otherwise. Caller should persist
    the path on the version row when non-None.
    """
    try:
        if mime == "application/pdf":
            png = generate_first_page_png(pdf_bytes)
        elif mime and mime.startswith("image/"):
            png = generate_image_thumbnail(pdf_bytes, mime)
        else:
            return None
    except Exception as exc:  # noqa: BLE001 — best-effort, never block upload
        logger.warning(
            "thumbnail render failed",
            document_id=document_id,
            version_id=version_id,
            mime=mime,
            error=str(exc),
        )
        return None
    path = build_thumbnail_path(tenant_id, document_id, version_number)
    try:
        storage.upload_object(path, png, "image/png")
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "thumbnail upload failed",
            document_id=document_id,
            version_id=version_id,
            path=path,
            error=str(exc),
        )
        return None
    return path


class DocumentService:
    @staticmethod
    async def list_documents(
        tenant_id: UUID,
        contact_id: UUID | None = None,
        property_id: UUID | None = None,
        area_id: UUID | None = None,
        query: str | None = None,
    ) -> list[dict]:
        client = get_supabase_client()
        if contact_id or property_id or area_id:
            assign_q = client.table(ASSIGNMENTS_TABLE).select("document_id").eq("tenant_id", str(tenant_id))
            if contact_id:
                assign_q = assign_q.eq("contact_id", str(contact_id))
            if property_id:
                assign_q = assign_q.eq("property_id", str(property_id))
            if area_id:
                assign_q = assign_q.eq("internal_area_id", str(area_id))
            doc_ids = [row["document_id"] for row in assign_q.execute().data]
            if not doc_ids:
                return []
            builder = (
                client.table(DOCUMENTS_TABLE)
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .in_("id", doc_ids)
            )
        else:
            builder = (
                client.table(DOCUMENTS_TABLE).select("*").eq("tenant_id", str(tenant_id)).is_("deleted_at", "null")
            )
        if query:
            builder = builder.ilike("display_name", f"%{query}%")
        builder = builder.order("sort_order").order("created_at", desc=True)
        docs = builder.execute().data
        # Hydrate current_version + thumbnail_url for grid cards in a single round-trip.
        version_ids = [d.get("current_version_id") for d in docs if d.get("current_version_id")]
        if version_ids:
            versions = (
                client.table(VERSIONS_TABLE)
                .select("id, version_number, thumbnail_path, mime_type, page_count")
                .in_("id", version_ids)
                .execute()
                .data
            )
            by_id = {v["id"]: v for v in versions}
            for d in docs:
                v = by_id.get(d.get("current_version_id"))
                if not v:
                    continue
                if v.get("thumbnail_path"):
                    try:
                        v["thumbnail_url"] = storage.signed_url(v["thumbnail_path"])
                    except Exception:
                        v["thumbnail_url"] = None
                d["current_version"] = v
        # Hydrate assignments per doc so grouping by property/contact works on FE.
        doc_ids_all = [d["id"] for d in docs]
        if doc_ids_all:
            assigns = (
                client.table(ASSIGNMENTS_TABLE)
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .in_("document_id", doc_ids_all)
                .execute()
                .data
            )
            grouped: dict[str, list[dict]] = {}
            for a in assigns:
                grouped.setdefault(a["document_id"], []).append(a)
            for d in docs:
                d["assignments"] = grouped.get(d["id"], [])
        return docs

    @staticmethod
    async def get_document(document_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        doc_resp = (
            client.table(DOCUMENTS_TABLE)
            .select("*")
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        if not doc_resp.data:
            raise HTTPException(status_code=404, detail="Document not found")
        doc = doc_resp.data
        versions = (
            client.table(VERSIONS_TABLE)
            .select("*")
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .order("version_number", desc=True)
            .execute()
            .data
        )
        assignments = (
            client.table(ASSIGNMENTS_TABLE)
            .select("*")
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
        )
        # Hydrate signed URLs for any version that has source images, so the
        # FE can re-open the scanner editor without a follow-up round-trip.
        for v in versions:
            paths = v.get("source_image_paths") or []
            if paths:
                v["source_image_urls"] = [storage.signed_url(p) for p in paths]
            thumb = v.get("thumbnail_path")
            if thumb:
                try:
                    v["thumbnail_url"] = storage.signed_url(thumb)
                except Exception:
                    logger.warning("thumbnail signed url failed", path=thumb)
                    v["thumbnail_url"] = None
        doc["versions"] = versions
        doc["assignments"] = assignments
        doc["current_version"] = next(
            (v for v in versions if v["id"] == doc.get("current_version_id")),
            None,
        )
        return doc

    @staticmethod
    async def create_document_with_first_version(
        tenant_id: UUID,
        created_by: UUID,
        display_name: str,
        origin: str,
        content: bytes,
        declared_mime: str | None,
        original_filename: str | None,
        tag: str | None = None,
        download_filename: str | None = None,
        edit_metadata: dict | None = None,
        source_raw_path: str | None = None,
        source_images: list[tuple[bytes, str | None]] | None = None,
        source_edit_states: list[dict] | None = None,
    ) -> dict:
        mime = validate_upload(content, declared_mime)
        kind = kind_from_mime(mime)

        # Para PDFs aplicamos strip de metadata; resto se guarda tal cual.
        original_metadata: dict[str, object] = {}
        page_count: int | None = None
        if mime == "application/pdf":
            original_metadata, page_count = extract_pdf_metadata(content)
            normalized_content = strip_pdf_metadata(content)
            normalized_mime = "application/pdf"
        else:
            normalized_content = content
            normalized_mime = mime

        sha = sha256_hex(normalized_content)
        ext = storage.ext_for_mime(mime)
        document_id = str(uuid4())

        raw = storage.raw_path(str(tenant_id), document_id, sha, ext)
        norm = storage.normalized_path(str(tenant_id), document_id, sha)
        storage.upload_object(raw, content, mime)
        storage.upload_object(norm, normalized_content, normalized_mime)

        scan_status = scan_file(content)

        client = get_supabase_client()
        doc_payload = {
            "id": document_id,
            "tenant_id": str(tenant_id),
            "display_name": display_name,
            "kind": kind,
            "origin": origin,
            "tag": tag,
            "created_by": str(created_by),
        }
        ocr_status = "skipped" if mime != "application/pdf" else "pending"
        version_payload = {
            "document_id": document_id,
            "tenant_id": str(tenant_id),
            "version_number": 1,
            "raw_path": raw,
            "normalized_path": norm,
            "size_bytes": len(normalized_content),
            "page_count": page_count,
            "sha256": sha,
            "mime_type": normalized_mime,
            "original_filename": original_filename,
            "original_metadata": original_metadata,
            "download_filename": download_filename or display_name,
            "scan_status": scan_status,
            "ocr_status": ocr_status,
            "created_by": str(created_by),
        }
        if edit_metadata is not None:
            version_payload["edit_metadata"] = edit_metadata
        if source_raw_path is not None:
            version_payload["source_raw_path"] = source_raw_path

        # Upload original camera shots (one per page) if provided.
        source_paths: list[str] = []
        if source_images:
            for i, (img_content, img_mime) in enumerate(source_images):
                effective_mime = img_mime or "image/jpeg"
                ext_i = storage.ext_for_mime(effective_mime)
                path_i = storage.source_image_path(str(tenant_id), document_id, 1, i, ext_i)
                try:
                    storage.upload_object(path_i, img_content, effective_mime)
                    source_paths.append(path_i)
                except Exception:
                    # Cleanup any uploaded so far + main blobs, then bubble up.
                    for p in source_paths + [raw, norm]:
                        try:
                            storage.delete_object(p)
                        except Exception:
                            logger.error("orphan cleanup failed", path=p)
                    raise
        if source_paths:
            version_payload["source_image_paths"] = source_paths
        if source_edit_states is not None:
            version_payload["source_edit_states"] = source_edit_states

        try:
            client.table(DOCUMENTS_TABLE).insert(doc_payload).execute()
            version_row = client.table(VERSIONS_TABLE).insert(version_payload).execute().data[0]
            client.table(DOCUMENTS_TABLE).update({"current_version_id": version_row["id"]}).eq(
                "id", document_id
            ).execute()
        except Exception:
            # Cleanup orphaned blobs si falla DB insert
            for path in (raw, norm, *source_paths):
                try:
                    storage.delete_object(path)
                except Exception:
                    logger.error("orphan cleanup failed", path=path)
            raise

        thumb_path = _maybe_generate_thumbnail(
            mime=mime,
            pdf_bytes=normalized_content,
            tenant_id=str(tenant_id),
            document_id=document_id,
            version_id=version_row["id"],
            version_number=1,
        )
        if thumb_path:
            try:
                client.table(VERSIONS_TABLE).update({"thumbnail_path": thumb_path}).eq(
                    "id", version_row["id"]
                ).execute()
            except Exception as exc:  # noqa: BLE001
                logger.warning("thumbnail path persist failed", error=str(exc))

        return await DocumentService.get_document(UUID(document_id), tenant_id)

    @staticmethod
    async def add_version(
        document_id: UUID,
        tenant_id: UUID,
        created_by: UUID,
        content: bytes,
        declared_mime: str | None,
        original_filename: str | None,
        notes: str | None = None,
        download_filename: str | None = None,
        edit_metadata: dict | None = None,
        source_version_id: UUID | None = None,
        source_images: list[tuple[bytes, str | None]] | None = None,
        source_edit_states: list[dict] | None = None,
    ) -> dict:
        client = get_supabase_client()
        doc_resp = (
            client.table(DOCUMENTS_TABLE)
            .select("*")
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        if not doc_resp.data:
            raise HTTPException(status_code=404, detail="Document not found")

        mime = validate_upload(content, declared_mime)
        original_metadata: dict[str, object] = {}
        page_count: int | None = None
        if mime == "application/pdf":
            original_metadata, page_count = extract_pdf_metadata(content)
            normalized_content = strip_pdf_metadata(content)
            normalized_mime = "application/pdf"
        else:
            normalized_content = content
            normalized_mime = mime

        sha = sha256_hex(normalized_content)
        ext = storage.ext_for_mime(mime)

        # dedup: misma sha = no crea nueva versión, actualiza current pointer
        existing = (
            client.table(VERSIONS_TABLE)
            .select("*")
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .eq("sha256", sha)
            .execute()
            .data
        )
        if existing:
            existing_v = existing[0]
            client.table(DOCUMENTS_TABLE).update({"current_version_id": existing_v["id"]}).eq(
                "id", str(document_id)
            ).execute()
            return await DocumentService.get_document(document_id, tenant_id)

        last = (
            client.table(VERSIONS_TABLE)
            .select("version_number")
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .order("version_number", desc=True)
            .limit(1)
            .execute()
            .data
        )
        next_number = (last[0]["version_number"] + 1) if last else 1

        raw = storage.raw_path(str(tenant_id), str(document_id), sha, ext)
        norm = storage.normalized_path(str(tenant_id), str(document_id), sha)
        storage.upload_object(raw, content, mime)
        storage.upload_object(norm, normalized_content, normalized_mime)

        scan_status = scan_file(content)
        ocr_status = "skipped" if mime != "application/pdf" else "pending"
        version_payload = {
            "document_id": str(document_id),
            "tenant_id": str(tenant_id),
            "version_number": next_number,
            "raw_path": raw,
            "normalized_path": norm,
            "size_bytes": len(normalized_content),
            "page_count": page_count,
            "sha256": sha,
            "mime_type": normalized_mime,
            "original_filename": original_filename,
            "original_metadata": original_metadata,
            "download_filename": download_filename,
            "scan_status": scan_status,
            "ocr_status": ocr_status,
            "notes": notes,
            "created_by": str(created_by),
        }
        if edit_metadata is not None:
            version_payload["edit_metadata"] = edit_metadata
        if source_version_id is not None:
            source = (
                client.table(VERSIONS_TABLE)
                .select("raw_path")
                .eq("id", str(source_version_id))
                .eq("tenant_id", str(tenant_id))
                .single()
                .execute()
                .data
            )
            if source:
                version_payload["source_raw_path"] = source["raw_path"]

        # Upload original camera shots if provided.
        source_paths: list[str] = []
        if source_images:
            for i, (img_content, img_mime) in enumerate(source_images):
                effective_mime = img_mime or "image/jpeg"
                ext_i = storage.ext_for_mime(effective_mime)
                path_i = storage.source_image_path(str(tenant_id), str(document_id), next_number, i, ext_i)
                try:
                    storage.upload_object(path_i, img_content, effective_mime)
                    source_paths.append(path_i)
                except Exception:
                    for p in source_paths + [raw, norm]:
                        try:
                            storage.delete_object(p)
                        except Exception:
                            logger.error("orphan cleanup failed", path=p)
                    raise
        if source_paths:
            version_payload["source_image_paths"] = source_paths
        if source_edit_states is not None:
            version_payload["source_edit_states"] = source_edit_states

        try:
            version_row = client.table(VERSIONS_TABLE).insert(version_payload).execute().data[0]
            client.table(DOCUMENTS_TABLE).update({"current_version_id": version_row["id"]}).eq(
                "id", str(document_id)
            ).execute()
        except Exception:
            for path in (raw, norm, *source_paths):
                try:
                    storage.delete_object(path)
                except Exception:
                    logger.error("orphan cleanup failed", path=path)
            raise

        thumb_path = _maybe_generate_thumbnail(
            mime=mime,
            pdf_bytes=normalized_content,
            tenant_id=str(tenant_id),
            document_id=str(document_id),
            version_id=version_row["id"],
            version_number=next_number,
        )
        if thumb_path:
            try:
                client.table(VERSIONS_TABLE).update({"thumbnail_path": thumb_path}).eq(
                    "id", version_row["id"]
                ).execute()
            except Exception as exc:  # noqa: BLE001
                logger.warning("thumbnail path persist failed", error=str(exc))

        return await DocumentService.get_document(document_id, tenant_id)

    @staticmethod
    async def update_document(document_id: UUID, tenant_id: UUID, payload) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return await DocumentService.get_document(document_id, tenant_id)
        (
            client.table(DOCUMENTS_TABLE)
            .update(data)
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return await DocumentService.get_document(document_id, tenant_id)

    @staticmethod
    async def set_current_version(document_id: UUID, version_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        version = (
            client.table(VERSIONS_TABLE)
            .select("id, document_id")
            .eq("id", str(version_id))
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        client.table(DOCUMENTS_TABLE).update({"current_version_id": str(version_id)}).eq("id", str(document_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
        return await DocumentService.get_document(document_id, tenant_id)

    @staticmethod
    async def restore_original_from_version(
        document_id: UUID,
        version_id: UUID,
        tenant_id: UUID,
        created_by: UUID,
    ) -> dict:
        client = get_supabase_client()
        version = (
            client.table(VERSIONS_TABLE)
            .select("source_raw_path, mime_type")
            .eq("id", str(version_id))
            .eq("document_id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not version or not version.get("source_raw_path"):
            raise HTTPException(
                status_code=400,
                detail="Version has no source_raw_path; nothing to restore",
            )
        content = storage.download_object(version["source_raw_path"])
        return await DocumentService.add_version(
            document_id=document_id,
            tenant_id=tenant_id,
            created_by=created_by,
            content=content,
            declared_mime=None,
            original_filename=None,
            notes="Restored original",
        )

    @staticmethod
    async def soft_delete_document(document_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        from datetime import datetime

        (
            client.table(DOCUMENTS_TABLE)
            .update({"deleted_at": datetime.now(UTC).isoformat()})
            .eq("id", str(document_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )

    @staticmethod
    async def add_assignment(document_id: UUID, tenant_id: UUID, payload) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        data["target_kind"] = data["target_kind"].value
        data["document_id"] = str(document_id)
        data["tenant_id"] = str(tenant_id)
        for key in ("contact_id", "property_id", "internal_area_id"):
            if data.get(key) is not None:
                data[key] = str(data[key])
        response = client.table(ASSIGNMENTS_TABLE).insert(data).execute()
        return response.data[0]

    @staticmethod
    async def remove_assignment(assignment_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (
            client.table(ASSIGNMENTS_TABLE)
            .delete()
            .eq("id", str(assignment_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )

    @staticmethod
    async def get_source_images(
        version_id: UUID,
        tenant_id: UUID,
        expires_in: int = 3600,
    ) -> dict:
        client = get_supabase_client()
        version = (
            client.table(VERSIONS_TABLE)
            .select("source_image_paths, source_edit_states")
            .eq("id", str(version_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        paths = version.get("source_image_paths") or []
        urls = [storage.signed_url(p, expires_in) for p in paths]
        return {"urls": urls, "edit_states": version.get("source_edit_states") or []}

    @staticmethod
    async def get_version_signed_url(version_id: UUID, tenant_id: UUID, expires_in: int = 3600) -> tuple[str, dict]:
        client = get_supabase_client()
        version = (
            client.table(VERSIONS_TABLE)
            .select("*")
            .eq("id", str(version_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version not found",
            )
        url = storage.signed_url(version["normalized_path"], expires_in)
        return url, version
