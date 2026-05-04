"""user_phones admin endpoints — assign E.164 phone → internal user."""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user, get_tenant_id
from app.core.supabase.client import get_supabase_client

router = APIRouter(prefix="/user-phones", tags=["user-phones"])

E164 = re.compile(r"^\+[1-9]\d{6,14}$")


class PhoneAssign(BaseModel):
    user_id: UUID
    phone_e164: str = Field(min_length=8, max_length=20)
    verified: bool = True


@router.get("")
async def list_phones(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    db = get_supabase_client()
    return (
        db.table("user_phones")
        .select("id, user_id, phone_e164, verified_at, created_at")
        .eq("tenant_id", str(tenant_id))
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


@router.post("", status_code=201)
async def assign_phone(
    payload: PhoneAssign,
    tenant_id: UUID = Depends(get_tenant_id),
    _user: dict = Depends(get_current_user),
) -> dict:
    if not E164.match(payload.phone_e164):
        raise HTTPException(status_code=400, detail="phone must be E.164 (e.g. +56911112222)")
    db = get_supabase_client()
    from datetime import UTC, datetime
    row = {
        "tenant_id": str(tenant_id),
        "user_id": str(payload.user_id),
        "phone_e164": payload.phone_e164,
        "verified_at": datetime.now(UTC).isoformat() if payload.verified else None,
    }
    try:
        return db.table("user_phones").insert(row).execute().data[0]
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "duplicate" in msg.lower() or "23505" in msg:
            raise HTTPException(status_code=409, detail="phone already assigned") from exc
        raise


@router.delete("/{phone_id}")
async def unassign_phone(
    phone_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    db = get_supabase_client()
    db.table("user_phones").delete().eq("id", str(phone_id)).eq(
        "tenant_id", str(tenant_id)
    ).execute()
    return {"status": "deleted"}
