from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.dependencies import get_tenant_id, require_role
from app.features.compliance.schemas import (
    ConsentEvidence,
    ConsentGrantRequest,
    ConsentRevokeRequest,
    SubjectExport,
)
from app.features.compliance.service import ComplianceService

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.post("/contacts/{contact_id}/consent")
async def grant_consent(
    contact_id: UUID,
    payload: ConsentGrantRequest,
    request: Request,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict[str, Any]:
    # Auto-fill missing IP / UA from the request if caller did not provide.
    if not payload.evidence.ip:
        payload.evidence = ConsentEvidence(
            ip=(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
            text_shown=payload.evidence.text_shown,
            channel=payload.evidence.channel,
        )
    return await ComplianceService.record_consent(contact_id, tenant_id, payload)


@router.delete("/contacts/{contact_id}/consent")
async def revoke_consent(
    contact_id: UUID,
    payload: ConsentRevokeRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict[str, Any]:
    return await ComplianceService.revoke_consent(contact_id, tenant_id, payload)


admin_router = APIRouter(prefix="/admin/compliance", tags=["compliance-admin"])


@admin_router.get(
    "/contacts/{contact_id}/export",
    response_model=SubjectExport,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def export_subject(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> SubjectExport:
    """Ley 21.719 derecho de acceso/portabilidad. Admin-only.

    Tenant scoping: hereda multi-tenancy de plan lemon. Subject debe vivir
    en el tenant activo (X-Tenant-Id). Para cross-tenant: switch tenant
    primero.
    """
    return await ComplianceService.export_subject_data(contact_id, tenant_id)
