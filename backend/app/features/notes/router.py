from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.notes.schemas import NoteCreate, NoteResponse, NoteUpdate
from app.features.notes.service import NoteService

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteResponse])
async def list_notes(
    tenant_id: UUID = Depends(get_tenant_id),
    target_table: str | None = Query(default=None),
    target_row_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> list[dict]:
    return await NoteService.list_notes(tenant_id, target_table, target_row_id, limit)


@router.post("", response_model=NoteResponse, status_code=201)
async def create_note(
    payload: NoteCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await NoteService.create_note(payload, tenant_id, UUID(current_user["id"]))


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID, payload: NoteUpdate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await NoteService.update_note(note_id, payload, tenant_id)


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await NoteService.delete_note(note_id, tenant_id)
