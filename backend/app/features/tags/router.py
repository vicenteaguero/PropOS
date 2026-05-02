from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id
from app.features.tags.schemas import (
    TagCreate,
    TagResponse,
    TagUpdate,
)
from app.features.tags.service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await TagService.list_tags(tenant_id)


@router.post("", response_model=TagResponse, status_code=201)
async def create_tag(payload: TagCreate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TagService.create_tag(payload, tenant_id)


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(tag_id: UUID, payload: TagUpdate, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await TagService.update_tag(tag_id, payload, tenant_id)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: UUID, tenant_id: UUID = Depends(get_tenant_id)):
    await TagService.delete_tag(tag_id, tenant_id)
