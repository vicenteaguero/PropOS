from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.dependencies import get_current_user, get_tenant_id, require_role, require_scope
from app.features.notes.attachments import (
    MAX_ATTACHMENT_BYTES,
    MAX_ATTACHMENTS_PER_REQUEST,
    UnsupportedAttachmentError,
    add_attachments,
    delete_attachment,
    list_for_note,
    role_for_mime,
)
from app.features.notes.schemas import (
    NoteAttachment,
    NoteCreate,
    NoteResponse,
    NoteTarget,
    NoteTargetInput,
    NoteUpdate,
)
from app.features.notes.service import NoteService

router = APIRouter(
    prefix="/notes",
    tags=["notes"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("productividad")),
    ],
)


async def _require_note(note_id: UUID, tenant_id: UUID) -> dict:
    note = await NoteService.get_note(note_id, tenant_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.get("", response_model=list[NoteResponse])
async def list_notes(
    tenant_id: UUID = Depends(get_tenant_id),
    target_table: str | None = Query(default=None),
    target_row_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    """Notes for the tenant, or only those linked to one record.

    The filter matches both link generations: `note_targets` rows and the
    legacy `target_table`/`target_row_id` pair.
    """
    return await NoteService.list_notes(tenant_id, target_table, target_row_id, limit)


@router.post("", response_model=NoteResponse, status_code=201)
async def create_note(
    payload: NoteCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await NoteService.create_note(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: UUID, payload: NoteUpdate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await NoteService.update_note(note_id, payload, tenant_id)


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await NoteService.delete_note(note_id, tenant_id)


# ---------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------
@router.post("/{note_id}/targets", response_model=list[NoteTarget], status_code=201)
async def add_note_targets(
    note_id: UUID,
    payload: list[NoteTargetInput],
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    """Link a note to more records. Re-linking an existing record is a no-op."""
    await _require_note(note_id, tenant_id)
    return await NoteService.add_targets(note_id, tenant_id, UUID(current_user["id"]), payload)


@router.delete("/{note_id}/targets/{target_id}", status_code=204)
async def remove_note_target(
    note_id: UUID,
    target_id: str,
    tenant_id: UUID = Depends(get_tenant_id),
):
    """Unlink. `target_id` is a `note_targets` id, or "legacy" for the old pair."""
    removed = await NoteService.remove_target(note_id, tenant_id, target_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")


# ---------------------------------------------------------------------
# Attachments (photos + voice memos, stored as media_assets)
# ---------------------------------------------------------------------
@router.get("/{note_id}/attachments", response_model=list[NoteAttachment])
async def list_note_attachments(note_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    await _require_note(note_id, tenant_id)
    return list_for_note(tenant_id, note_id)


@router.post("/{note_id}/attachments", response_model=list[NoteAttachment], status_code=201)
async def upload_note_attachments(
    note_id: UUID,
    files: list[UploadFile] = File(...),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    await _require_note(note_id, tenant_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    if len(files) > MAX_ATTACHMENTS_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_ATTACHMENTS_PER_REQUEST} attachments per request",
        )

    payload: list[tuple[bytes, str | None, str | None]] = []
    for upload in files:
        mime = (upload.content_type or "").lower()
        try:
            role_for_mime(mime)
        except UnsupportedAttachmentError as exc:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported attachment type: {upload.content_type or 'unknown'}",
            ) from exc
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Attachment exceeds {MAX_ATTACHMENT_BYTES // (1024 * 1024)}MB",
            )
        payload.append((content, mime, upload.filename))

    return add_attachments(note_id, tenant_id, UUID(current_user["id"]), payload)


@router.delete("/{note_id}/attachments/{asset_id}", status_code=204)
async def remove_note_attachment(
    note_id: UUID,
    asset_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    if not delete_attachment(asset_id, note_id, tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
