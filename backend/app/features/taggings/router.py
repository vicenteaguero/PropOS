from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.tags.schemas import TaggingCreate, TaggingResponse
from app.features.tags.service import TagService

router = APIRouter(prefix="/taggings", tags=["taggings"])


@router.get("", response_model=list[TaggingResponse])
async def list_taggings(
    target_table: str = Query(...),
    target_row_id: UUID = Query(...),
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await TagService.list_taggings(tenant_id, target_table, target_row_id)


@router.post("", response_model=TaggingResponse, status_code=201)
async def add_tagging(
    payload: TaggingCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await TagService.add_tagging(payload, tenant_id, UUID(current_user["id"]))


@router.delete("/{tagging_id}", status_code=204)
async def remove_tagging(tagging_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TagService.remove_tagging(tagging_id, tenant_id)
