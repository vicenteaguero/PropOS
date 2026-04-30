from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.documents import storage
from app.features.documents.hashing import sha256_hex
from app.features.documents.passwords import hash_password, verify_password
from app.features.documents.service import DocumentService
from app.features.documents.slugs import generate_slug
from app.features.documents.stubs.scan import scan_file
from app.features.documents.validation import validate_upload

PORTALS_TABLE = "anonymous_upload_portals"
UPLOADS_TABLE = "anonymous_uploads"

logger = get_logger("PORTALS")


def _to_response(row: dict) -> dict:
    return {**row, "has_password": bool(row.get("password_hash"))}


class PortalService:
    @staticmethod
    async def create_portal(tenant_id: UUID, created_by: UUID, payload) -> dict:
        client = get_supabase_client()
        slug = generate_slug(10)
        for _ in range(5):
            existing = (
                client.table(PORTALS_TABLE)
                .select("id")
                .eq("slug", slug)
                .execute()
                .data
            )
            if not existing:
                break
            slug = generate_slug(10)

        data = payload.model_dump()
        password = data.pop("password", None)
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        data["slug"] = slug
        data["password_hash"] = hash_password(password) if password else None
        data["access_mode"] = data["access_mode"].value
        for key in ("default_property_id", "default_contact_id", "default_internal_area_id"):
            if data.get(key) is not None:
                data[key] = str(data[key])
        if data.get("expires_at") is not None:
            data["expires_at"] = data["expires_at"].isoformat()
        response = client.table(PORTALS_TABLE).insert(data).execute()
        return _to_response(response.data[0])

    @staticmethod
    async def list_portals(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        rows = (
            client.table(PORTALS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
            .execute()
            .data
        )
        return [_to_response(r) for r in rows]

    @staticmethod
    async def get_portal(portal_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        row = (
            client.table(PORTALS_TABLE)
            .select("*")
            .eq("id", str(portal_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Portal not found")
        return _to_response(row)

    @staticmethod
    async def update_portal(portal_id: UUID, tenant_id: UUID, payload) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        clear = data.pop("clear_password", False)
        if "password" in data:
            pw = data.pop("password")
            if pw:
                data["password_hash"] = hash_password(pw)
        if clear:
            data["password_hash"] = None
        if "access_mode" in data and data["access_mode"] is not None:
            data["access_mode"] = data["access_mode"].value
        for key in ("default_property_id", "default_contact_id", "default_internal_area_id"):
            if key in data and data[key] is not None:
                data[key] = str(data[key])
        if "expires_at" in data and data["expires_at"] is not None:
            data["expires_at"] = data["expires_at"].isoformat()
        (
            client.table(PORTALS_TABLE)
            .update(data)
            .eq("id", str(portal_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return await PortalService.get_portal(portal_id, tenant_id)

    @staticmethod
    async def delete_portal(portal_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (
            client.table(PORTALS_TABLE)
            .delete()
            .eq("id", str(portal_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )

    @staticmethod
    async def public_portal_view(slug: str) -> dict:
        client = get_supabase_client()
        row = (
            client.table(PORTALS_TABLE)
            .select("*")
            .eq("slug", slug)
            .eq("is_active", True)
            .maybe_single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Portal not found")
        if row.get("expires_at"):
            expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Portal expired")
        return {
            "slug": row["slug"],
            "title": row["title"],
            "description": row.get("description"),
            "max_file_size_mb": row["max_file_size_mb"],
            "requires_password": bool(row.get("password_hash")),
        }

    @staticmethod
    async def public_upload(
        slug: str,
        content: bytes,
        original_filename: str | None,
        declared_mime: str | None,
        uploader_label: str | None,
        uploader_ip: str | None,
        consent: bool,
        password: str | None,
    ) -> dict:
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Consent required to upload",
            )
        client = get_supabase_client()
        portal = (
            client.table(PORTALS_TABLE)
            .select("*")
            .eq("slug", slug)
            .eq("is_active", True)
            .maybe_single()
            .execute()
            .data
        )
        if not portal:
            raise HTTPException(status_code=404, detail="Portal not found")
        if portal.get("expires_at"):
            expires = datetime.fromisoformat(portal["expires_at"].replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Portal expired")
        if portal.get("password_hash"):
            if not password or not verify_password(password, portal["password_hash"]):
                raise HTTPException(status_code=401, detail="Invalid password")

        max_bytes = portal["max_file_size_mb"] * 1024 * 1024
        mime = validate_upload(content, declared_mime, max_bytes=max_bytes)
        sha = sha256_hex(content)
        ext = storage.ext_for_mime(mime)
        upload_id = str(uuid4())
        path = storage.anonymous_path(
            portal["tenant_id"], portal["id"], upload_id, ext
        )
        storage.upload_object(path, content, mime)

        # Background-equivalent scan (sync ya que es stub)
        scan_status = scan_file(content)
        if scan_status == "infected":
            storage.delete_object(path)
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="File rejected by security scan",
            )

        record = {
            "id": upload_id,
            "portal_id": portal["id"],
            "tenant_id": portal["tenant_id"],
            "storage_path": path,
            "original_filename": original_filename,
            "size_bytes": len(content),
            "sha256": sha,
            "mime_type": mime,
            "uploader_ip": uploader_ip,
            "uploader_label": uploader_label,
            "consent_given_at": datetime.now(timezone.utc).isoformat(),
        }
        response = client.table(UPLOADS_TABLE).insert(record).execute()
        return response.data[0]

    @staticmethod
    async def list_uploads(portal_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(UPLOADS_TABLE)
            .select("*")
            .eq("portal_id", str(portal_id))
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
            .execute()
            .data
        )

    @staticmethod
    async def reject_upload(
        upload_id: UUID, tenant_id: UUID, reviewed_by: UUID
    ) -> None:
        client = get_supabase_client()
        upload = (
            client.table(UPLOADS_TABLE)
            .select("*")
            .eq("id", str(upload_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        try:
            storage.delete_object(upload["storage_path"])
        except Exception:  # pragma: no cover
            pass
        (
            client.table(UPLOADS_TABLE)
            .update(
                {
                    "status": "rejected",
                    "reviewed_by": str(reviewed_by),
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", str(upload_id))
            .execute()
        )

    @staticmethod
    async def promote_upload(
        upload_id: UUID,
        tenant_id: UUID,
        reviewed_by: UUID,
        display_name: str,
        assignments: list,
    ) -> dict:
        client = get_supabase_client()
        upload = (
            client.table(UPLOADS_TABLE)
            .select("*")
            .eq("id", str(upload_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        if upload["status"] != "pending_review":
            raise HTTPException(
                status_code=400, detail="Upload already processed"
            )

        content = storage.download_object(upload["storage_path"])
        document = await DocumentService.create_document_with_first_version(
            tenant_id=tenant_id,
            created_by=reviewed_by,
            display_name=display_name,
            origin="ANONYMOUS_PORTAL",
            content=content,
            declared_mime=upload.get("mime_type"),
            original_filename=upload.get("original_filename"),
        )
        for assign in assignments:
            await DocumentService.add_assignment(
                UUID(document["id"]), tenant_id, assign
            )
        try:
            storage.delete_object(upload["storage_path"])
        except Exception:  # pragma: no cover
            pass
        (
            client.table(UPLOADS_TABLE)
            .update(
                {
                    "status": "approved",
                    "promoted_document_id": document["id"],
                    "reviewed_by": str(reviewed_by),
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", str(upload_id))
            .execute()
        )
        return document
