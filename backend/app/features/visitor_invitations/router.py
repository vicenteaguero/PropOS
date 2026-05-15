from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.visitor_invitations.schemas import (
    InvitationCreate,
    InvitationPublicView,
    InvitationResponse,
    PreflightResponse,
    SubmitPayload,
    SubmitResponse,
    UploadIdResponse,
)
from app.features.visitor_invitations.service import VisitorInvitationService

# ---------------------------------------------------------------- admin
admin_router = APIRouter(prefix="/visitor-invitations", tags=["visitor-invitations"])


@admin_router.get(
    "/preflight",
    response_model=PreflightResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def preflight(
    email: str = Query(...),
    rut: str | None = Query(default=None),
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> PreflightResponse:
    return await VisitorInvitationService.preflight(
        email=email,
        rut=rut,
        admin_user_id=UUID(current_user["id"]),
        active_tenant_id=tenant_id,
    )


@admin_router.post(
    "",
    response_model=InvitationResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def create_invitation(
    payload: InvitationCreate,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> InvitationResponse:
    return await VisitorInvitationService.create_invitation(payload, tenant_id, UUID(current_user["id"]))


@admin_router.get(
    "",
    response_model=list[InvitationResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def list_invitations(
    tenant_id: UUID = Depends(get_tenant_id),
    status: str | None = Query(default=None),
    property_id: UUID | None = Query(default=None),
) -> list[InvitationResponse]:
    return await VisitorInvitationService.list_invitations(tenant_id, status, property_id)


@admin_router.post(
    "/{invitation_id}/resend",
    response_model=InvitationResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def resend_invitation(
    invitation_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> InvitationResponse:
    return await VisitorInvitationService.resend_invitation(invitation_id, tenant_id)


@admin_router.delete(
    "/{invitation_id}",
    status_code=204,
    response_class=None,  # type: ignore[arg-type]
    dependencies=[Depends(require_role("ADMIN"))],
)
async def expire_invitation(
    invitation_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
):
    await VisitorInvitationService.expire_invitation(invitation_id, tenant_id)
    from fastapi import Response

    return Response(status_code=204)


# ---------------------------------------------------------------- public
public_router = APIRouter(prefix="/public/visitor-invitations", tags=["visitor-invitations-public"])


@public_router.get("/{slug}", response_model=InvitationPublicView)
async def resolve_public(slug: str) -> InvitationPublicView:
    return await VisitorInvitationService.resolve_public(slug)


@public_router.post("/{slug}/upload-id", response_model=UploadIdResponse)
async def upload_id(slug: str, file: UploadFile = File(...)) -> UploadIdResponse:
    content = await file.read()
    return await VisitorInvitationService.upload_id_pdf(slug, content)


@public_router.post("/{slug}/submit", response_model=SubmitResponse)
async def submit(
    slug: str,
    payload: SubmitPayload,
    request: Request,
) -> SubmitResponse:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return await VisitorInvitationService.submit_public(slug, payload, ip, ua)
