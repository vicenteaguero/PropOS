from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.documents import storage
from app.features.documents.passwords import hash_password, verify_password
from app.features.documents.slugs import generate_slug

SHARE_LINKS_TABLE = "share_links"
DOCUMENTS_TABLE = "documents"
VERSIONS_TABLE = "document_versions"

logger = get_logger("SHARE")


def _to_response(row: dict) -> dict:
    return {**row, "has_password": bool(row.get("password_hash"))}


class ShareService:
    @staticmethod
    async def create_share_link(
        tenant_id: UUID, created_by: UUID, payload
    ) -> dict:
        client = get_supabase_client()
        slug = generate_slug()
        # Garantizar unicidad (loop probabilísticamente raro)
        for _ in range(5):
            existing = (
                client.table(SHARE_LINKS_TABLE)
                .select("id")
                .eq("slug", slug)
                .execute()
                .data
            )
            if not existing:
                break
            slug = generate_slug()

        record = {
            "tenant_id": str(tenant_id),
            "slug": slug,
            "document_id": str(payload.document_id),
            "pinned_version_id": str(payload.pinned_version_id)
            if payload.pinned_version_id
            else None,
            "password_hash": hash_password(payload.password) if payload.password else None,
            "expires_at": payload.expires_at.isoformat() if payload.expires_at else None,
            "download_filename_override": payload.download_filename_override,
            "created_by": str(created_by),
        }
        response = client.table(SHARE_LINKS_TABLE).insert(record).execute()
        return _to_response(response.data[0])

    @staticmethod
    async def list_share_links(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        rows = (
            client.table(SHARE_LINKS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
            .execute()
            .data
        )
        return [_to_response(r) for r in rows]

    @staticmethod
    async def update_share_link(
        link_id: UUID, tenant_id: UUID, payload
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        clear = data.pop("clear_password", False)
        if "password" in data:
            pw = data.pop("password")
            if pw:
                data["password_hash"] = hash_password(pw)
        if clear:
            data["password_hash"] = None
        for key in ("document_id", "pinned_version_id"):
            if key in data and data[key] is not None:
                data[key] = str(data[key])
        if "expires_at" in data and data["expires_at"] is not None:
            data["expires_at"] = data["expires_at"].isoformat()
        if not data:
            return await ShareService.get_share_link(link_id, tenant_id)
        (
            client.table(SHARE_LINKS_TABLE)
            .update(data)
            .eq("id", str(link_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return await ShareService.get_share_link(link_id, tenant_id)

    @staticmethod
    async def get_share_link(link_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        row = (
            client.table(SHARE_LINKS_TABLE)
            .select("*")
            .eq("id", str(link_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Share link not found")
        return _to_response(row)

    @staticmethod
    async def delete_share_link(link_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        (
            client.table(SHARE_LINKS_TABLE)
            .delete()
            .eq("id", str(link_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )

    @staticmethod
    async def resolve_public(slug: str, password: str | None = None) -> dict:
        """
        Resuelve shortlink público sin auth. Valida activo, expiry, password.
        Retorna ShareLinkPublicView dict.
        """
        client = get_supabase_client()
        row = (
            client.table(SHARE_LINKS_TABLE)
            .select("*")
            .eq("slug", slug)
            .eq("is_active", True)
            .maybe_single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Share link not found")
        if row.get("expires_at"):
            from datetime import datetime, timezone

            expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Share link expired")
        if row.get("password_hash"):
            if not password or not verify_password(password, row["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Password required",
                    headers={"X-Requires-Password": "1"},
                )

        document = (
            client.table(DOCUMENTS_TABLE)
            .select("*")
            .eq("id", row["document_id"])
            .single()
            .execute()
            .data
        )
        if not document or document.get("deleted_at"):
            raise HTTPException(status_code=404, detail="Document unavailable")

        version_id = row.get("pinned_version_id") or document["current_version_id"]
        if not version_id:
            raise HTTPException(status_code=404, detail="No version available")
        version = (
            client.table(VERSIONS_TABLE)
            .select("*")
            .eq("id", version_id)
            .single()
            .execute()
            .data
        )
        if not version:
            raise HTTPException(status_code=404, detail="Version unavailable")

        download_filename = (
            row.get("download_filename_override")
            or version.get("download_filename")
            or document["display_name"]
        )
        url = storage.signed_url(version["normalized_path"], 3600)

        # Increment view_count (best-effort, no error si falla)
        try:
            (
                client.table(SHARE_LINKS_TABLE)
                .update({"view_count": (row.get("view_count") or 0) + 1})
                .eq("id", row["id"])
                .execute()
            )
        except Exception:  # pragma: no cover
            pass

        return {
            "slug": slug,
            "document_display_name": document["display_name"],
            "version_number": version["version_number"],
            "sha256_short": version["sha256"][:12],
            "mime_type": version["mime_type"],
            "page_count": version.get("page_count"),
            "download_filename": download_filename,
            "download_url": url,
            "requires_password": False,
            "expires_at": row.get("expires_at"),
        }
