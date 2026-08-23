from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.dependencies import get_current_user, get_tenant_id, require_feature, require_role, require_scope
from app.features.notes.attachments import (
    MAX_ATTACHMENT_BYTES,
    MAX_ATTACHMENTS_PER_REQUEST,
    UnsupportedAttachmentError,
    add_attachments,
    delete_attachment,
    list_for_note,
    role_for_mime,
)
from app.features.notes.schemas import NoteAttachment
from app.features.tasks.schemas import TaskCreate, TaskResponse, TaskUpdate
from app.features.tasks.service import TASKS_TABLE, TaskService

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("productividad")),
        Depends(require_feature("productividad")),
    ],
)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    tenant_id: UUID = Depends(get_tenant_id),
    kind: str | None = Query(default=None),
    status: str | None = Query(default=None),
    owner_user: UUID | None = Query(default=None),
    only_open: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[dict]:
    return await TaskService.list_tasks(tenant_id, kind, status, owner_user, only_open, limit)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TaskService.get_task(task_id, tenant_id)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await TaskService.create_task(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await TaskService.update_task(task_id, payload, tenant_id)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TaskService.delete_task(task_id, tenant_id)


# ---------------------------------------------------------------------
# Attachments — the same `media_assets` rows notes use, with
# `target_table='tasks'`. A task could hold a title and a date and nothing
# else, so "the photo of the damp patch" or "the scan they sent" had nowhere
# to live except a note that mentioned the task by name.
# ---------------------------------------------------------------------


@router.get("/{task_id}/attachments", response_model=list[NoteAttachment])
async def list_task_attachments(task_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    await TaskService.get_task(task_id, tenant_id)
    return list_for_note(tenant_id, task_id, TASKS_TABLE)


@router.post("/{task_id}/attachments", response_model=list[NoteAttachment], status_code=201)
async def upload_task_attachments(
    task_id: UUID,
    files: list[UploadFile] = File(...),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict]:
    await TaskService.get_task(task_id, tenant_id)
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

    return add_attachments(task_id, tenant_id, UUID(current_user["id"]), payload, TASKS_TABLE)


@router.delete("/{task_id}/attachments/{asset_id}", status_code=204)
async def remove_task_attachment(
    task_id: UUID,
    asset_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    if not delete_attachment(asset_id, task_id, tenant_id, TASKS_TABLE):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
