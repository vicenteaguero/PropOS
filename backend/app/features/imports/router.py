from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.dependencies import get_current_user, get_tenant_id, require_role, require_scope
from app.features.imports.service import ImportService

router = APIRouter(
    prefix="/imports",
    tags=["imports"],
    dependencies=[Depends(require_role("ADMIN")), Depends(require_scope("datos"))],
)

_ENTITIES = {"contacts", "transactions"}


@router.get("")
async def list_imports(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    return await ImportService.list_jobs(tenant_id)


@router.post("")
async def create_import(
    entity: str = Form(...),
    file: UploadFile = File(...),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    if entity not in _ENTITIES:
        raise HTTPException(status_code=400, detail=f"unsupported entity: {entity}")
    content = await file.read()
    return await ImportService.preview(
        entity, file.filename or "import.csv", content, tenant_id, UUID(current_user["id"])
    )


@router.post("/{import_id}/commit")
async def commit_import(
    import_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    try:
        return await ImportService.commit(import_id, tenant_id, UUID(current_user["id"]))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
