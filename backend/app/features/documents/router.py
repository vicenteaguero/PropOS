from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_tenant_id, require_role
from app.features.documents.schemas import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
)
from app.features.documents.service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse], dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def list_documents(
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return await DocumentService.list_documents(tenant_id)


@router.get("/{document_id}", response_model=DocumentResponse, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def get_document(
    document_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.get_document(document_id, tenant_id)


@router.post("", response_model=DocumentResponse, status_code=201, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def create_document(
    payload: DocumentCreate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.create_document(payload, tenant_id)


@router.patch("/{document_id}", response_model=DocumentResponse, dependencies=[Depends(require_role("ADMIN", "AGENT"))])
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    return await DocumentService.update_document(document_id, payload, tenant_id)


@router.delete("/{document_id}", status_code=204, dependencies=[Depends(require_role("ADMIN"))])
async def delete_document(
    document_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    await DocumentService.delete_document(document_id, tenant_id)
