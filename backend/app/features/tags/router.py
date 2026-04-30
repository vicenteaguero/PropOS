from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_tenant_id
from app.features.tags.schemas import (
    TagCreate,
    TaggingCreate,
    TaggingResponse,
    TagResponse,
    TagUpdate,
)
from app.features.tags.service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await TagService.list_tags(tenant_id)


@router.post("", response_model=TagResponse, status_code=201)
async def create_tag(
    payload: TagCreate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await TagService.create_tag(payload, tenant_id)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: UUID, payload: TagUpdate, tenant_id: UUID = Depends(get_tenant_id)
) -> dict:
    return await TagService.update_tag(tag_id, payload, tenant_id)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TagService.delete_tag(tag_id, tenant_id)


@router.get("/taggings", response_model=list[TaggingResponse])
async def list_taggings(
    target_table: str = Query(...),
    target_row_id: UUID = Query(...),
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await TagService.list_taggings(tenant_id, target_table, target_row_id)


@router.post("/taggings", response_model=TaggingResponse, status_code=201)
async def add_tagging(
    payload: TaggingCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    return await TagService.add_tagging(payload, tenant_id, UUID(current_user["id"]))


@router.delete("/taggings/{tagging_id}", status_code=204)
async def remove_tagging(
    tagging_id: UUID, tenant_id: UUID = Depends(get_tenant_id)
):
    await TagService.remove_tagging(tagging_id, tenant_id)
