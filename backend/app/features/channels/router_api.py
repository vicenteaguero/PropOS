"""PWA-facing REST endpoints for client_chat + opt-in capture."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user, get_tenant_id
from app.core.supabase.client import get_supabase_client


def _now() -> str:
    return datetime.now(UTC).isoformat()


router = APIRouter(prefix="/client-chat", tags=["client-chat"])


class SendMessage(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TakeoverPayload(BaseModel):
    ai_enabled: bool | None = None
    status: str | None = Field(default=None, pattern="^(open|assigned|closed)$")


class ConsentPayload(BaseModel):
    contact_id: UUID
    channel: str = Field(default="whatsapp", pattern="^(whatsapp|email)$")
    method: str = Field(default="broker_attestation")
    proof: dict[str, Any] = Field(default_factory=dict)


@router.get("/conversations")
async def list_conversations(
    tenant_id: UUID = Depends(get_tenant_id),
    status: str | None = None,
) -> list[dict]:
    db = get_supabase_client()
    q = (
        db.table("client_conversations")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .order("last_message_at", desc=True)
        .limit(200)
    )
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    limit: int = 200,
) -> list[dict]:
    db = get_supabase_client()
    return (
        db.table("client_messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .eq("tenant_id", str(tenant_id))
        .order("created_at")
        .limit(limit)
        .execute()
        .data
        or []
    )


@router.post("/conversations/{conversation_id}/send")
async def send_human_reply(
    conversation_id: UUID,
    payload: SendMessage,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
) -> dict:
    from app.features.notifications.whatsapp.dispatcher import (
        ConsentError,
        WindowError,
        send_freeform_to_conversation,
    )

    try:
        return await send_freeform_to_conversation(
            tenant_id,
            conversation_id,
            payload.text,
            sender_user_id=current_user["id"],
        )
    except ConsentError as exc:
        raise HTTPException(status_code=409, detail=f"consent: {exc}") from exc
    except WindowError as exc:
        raise HTTPException(status_code=409, detail=f"window: {exc}") from exc


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: UUID,
    payload: TakeoverPayload,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_supabase_client()
    updates: dict[str, Any] = {}
    if payload.ai_enabled is not None:
        updates["ai_enabled"] = payload.ai_enabled
    if payload.status:
        updates["status"] = payload.status
        if payload.status == "assigned":
            updates["assigned_user_id"] = current_user["id"]
    if not updates:
        raise HTTPException(status_code=400, detail="empty patch")
    rows = (
        db.table("client_conversations")
        .update(updates)
        .eq("id", str(conversation_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="conversation not found")
    return rows[0]


@router.post("/consents")
async def upsert_consent(
    payload: ConsentPayload,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_supabase_client()
    existing = (
        db.table("client_consents")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("contact_id", str(payload.contact_id))
        .eq("channel", payload.channel)
        .limit(1)
        .execute()
        .data
    )
    base = {
        "tenant_id": str(tenant_id),
        "contact_id": str(payload.contact_id),
        "channel": payload.channel,
        "opted_in_at": _now(),
        "opted_out_at": None,
        "method": payload.method,
        "proof": payload.proof,
        "created_by": current_user["id"],
    }
    if existing:
        return db.table("client_consents").update(base).eq("id", existing[0]["id"]).execute().data[0]
    return db.table("client_consents").insert(base).execute().data[0]


@router.delete("/consents/{contact_id}")
async def revoke_consent(
    contact_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    channel: str = "whatsapp",
) -> dict:
    db = get_supabase_client()
    db.table("client_consents").update({"opted_out_at": _now(), "opted_in_at": None}).eq(
        "tenant_id", str(tenant_id)
    ).eq("contact_id", str(contact_id)).eq("channel", channel).execute()
    return {"status": "revoked"}
