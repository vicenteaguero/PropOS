from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config.settings import settings
from app.core.dependencies import get_tenant_id, require_role, require_scope
from app.features.compliance.service import ConsentDeniedError
from app.features.email_sync.compose import EmailComposeService, SendEmailRequest
from app.features.email_sync.schemas import (
    EmailThreadDetail,
    EmailThreadResponse,
    ReplyRequest,
)
from app.features.email_sync.service import EmailSyncService

router = APIRouter(
    prefix="/email",
    tags=["email"],
    dependencies=[Depends(require_role("ADMIN", "AGENT")), Depends(require_scope("email"))],
)


@router.get("/threads", response_model=list[EmailThreadResponse])
async def list_threads(
    tenant_id: UUID = Depends(get_tenant_id),
    status: str | None = Query(default=None),
    contact_id: UUID | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[dict]:
    return await EmailSyncService.list_threads(tenant_id, status, contact_id, q)


@router.get("/threads/{thread_id}", response_model=EmailThreadDetail)
async def get_thread(thread_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await EmailSyncService.get_thread(thread_id, tenant_id)


@router.post("/threads/{thread_id}/reply", response_model=dict)
async def reply(thread_id: UUID, payload: ReplyRequest, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    try:
        return await EmailSyncService.reply(
            thread_id, tenant_id, payload.body, payload.subject, account_email=settings.email_imap_user
        )
    except ConsentDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contact has not consented to email contact",
        ) from exc


@router.post("/threads/{thread_id}/archive", response_model=EmailThreadResponse)
async def archive(thread_id: UUID, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    return await EmailSyncService.archive_thread(thread_id, tenant_id)


@router.post("/send", response_model=EmailThreadResponse, status_code=201)
async def send_new_email(payload: SendEmailRequest, tenant_id: UUID = Depends(get_tenant_id)) -> dict:
    """Start a thread with someone who has not written first. Delivery via Resend."""
    try:
        return await EmailComposeService.send(
            tenant_id,
            str(payload.to),
            payload.subject,
            payload.body,
            payload.contact_id,
        )
    except ConsentDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contact has not consented to email contact",
        ) from exc
