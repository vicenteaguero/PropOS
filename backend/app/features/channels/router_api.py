"""PWA-facing REST endpoints for client_chat + opt-in capture."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.dependencies import (
    get_current_user,
    get_tenant_id,
    require_feature,
    require_role,
    require_scope,
)
from app.core.phone import to_e164
from app.core.supabase.client import get_supabase_client


def _now() -> str:
    return datetime.now(UTC).isoformat()


# The B2C inbox speaks to contacts through the brokerage's own WhatsApp number,
# so every route here can impersonate the broker. Staff only, behind the same
# `inbox` scope the PWA uses to show the section.
router = APIRouter(
    prefix="/client-chat",
    tags=["client-chat"],
    dependencies=[
        Depends(require_role("ADMIN", "AGENT")),
        Depends(require_scope("inbox")),
        Depends(require_feature("conversaciones")),
    ],
)


class SendMessage(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TakeoverPayload(BaseModel):
    ai_enabled: bool | None = None
    status: str | None = Field(default=None, pattern="^(open|assigned|closed)$")
    archived: bool | None = None


class ConsentPayload(BaseModel):
    contact_id: UUID
    channel: str = Field(default="whatsapp", pattern="^(whatsapp|email)$")
    method: str = Field(default="broker_attestation")
    proof: dict[str, Any] = Field(default_factory=dict)


@router.get("/conversations")
async def list_conversations(
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    status: str | None = None,
    archived: bool = False,
    waiting_on: str | None = None,
    unidentified: bool | None = None,
) -> list[dict]:
    """Threads, filterable by who is waiting and whether we know who they are.

    `unidentified` is the queue that used to not exist: a message from an
    unknown number silently minted a contact called after its own phone number,
    so the pile was invisible and made of junk rows.
    """
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
    if waiting_on:
        q = q.eq("waiting_on", waiting_on)
    if unidentified is True:
        q = q.is_("contact_id", "null")
    elif unidentified is False:
        q = q.not_.is_("contact_id", "null")
    if archived:
        q = q.not_.is_("archived_at", "null")
    else:
        q = q.is_("archived_at", "null")
    rows = q.execute().data or []
    _decorate_conversations(db, tenant_id, rows)
    _decorate_unread(db, tenant_id, UUID(str(current_user["id"])), rows)
    return rows


def _decorate_unread(db, tenant_id: UUID, user_id: UUID, rows: list[dict]) -> None:
    """Attach `unread_count` and `last_preview` to every row, in place.

    One RPC for the whole page. The alternative — a count per conversation —
    is 200 round trips to draw 200 dots.

    Best-effort, like the labels above it: an inbox with no unread badges is a
    worse inbox, an inbox that 500s is no inbox.
    """
    if not rows:
        return
    try:
        counts = (
            db.rpc(
                "conversation_unread_counts",
                {"p_tenant": str(tenant_id), "p_user": str(user_id)},
            )
            .execute()
            .data
            or []
        )
    except Exception:  # noqa: BLE001
        for row in rows:
            row.setdefault("unread_count", 0)
            row.setdefault("last_preview", None)
        return

    by_id = {c["conversation_id"]: c for c in counts}
    for row in rows:
        hit = by_id.get(row["id"]) or {}
        row["unread_count"] = hit.get("unread_count") or 0
        # The list endpoint never touched `client_messages`, so an inbox row
        # carried the contact's name and nothing they had actually said.
        row["last_preview"] = hit.get("last_preview")


@router.post("/conversations/{conversation_id}/read", status_code=204)
async def mark_conversation_read(
    conversation_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
) -> None:
    """Mark everything up to now as read, for the calling user only."""
    db = get_supabase_client()
    db.table("conversation_reads").upsert(
        {
            "tenant_id": str(tenant_id),
            "conversation_id": str(conversation_id),
            "user_id": str(current_user["id"]),
            "read_at": datetime.now(UTC).isoformat(),
        },
        on_conflict="conversation_id,user_id",
    ).execute()


def _decorate_conversations(db, tenant_id: UUID, rows: list[dict]) -> None:
    """Attach the contact's name and the property the thread is about.

    Both are what the inbox row is READ by — a broker recognises "Rocío Vergara"
    and "Depto 2D Ñuñoa", never a uuid or a phone number — and the browser used
    to assemble them itself by fetching 500 contacts and 500 opportunities on
    every visit to Conversaciones, purely to build two lookup maps. That is a
    thousand rows over the wire to label at most 200, and it made the section
    the slowest in the app.

    Resolved here in two bounded queries against the ids actually present.
    Failure is not fatal: an inbox that lists threads without names still works,
    and it is a far better outcome than an inbox that does not load.
    """
    contact_ids = {r["contact_id"] for r in rows if r.get("contact_id")}
    if not contact_ids:
        return
    try:
        contacts = (
            db.table("contacts")
            .select("id,full_name")
            .eq("tenant_id", str(tenant_id))
            .in_("id", list(contact_ids))
            .execute()
            .data
            or []
        )
        names = {c["id"]: c.get("full_name") for c in contacts}

        # The property comes through the person's open deal, which is the same
        # join the browser was doing — one hop, server side.
        opps = (
            db.table("opportunities")
            .select("person_id,property_id")
            .eq("tenant_id", str(tenant_id))
            .eq("status", "OPEN")
            .in_("person_id", list(contact_ids))
            .not_.is_("property_id", "null")
            .execute()
            .data
            or []
        )
        property_by_person: dict[str, str] = {}
        for o in opps:
            property_by_person.setdefault(o["person_id"], o["property_id"])

        titles: dict[str, str] = {}
        if property_by_person:
            props = (
                db.table("properties")
                .select("id,title")
                .eq("tenant_id", str(tenant_id))
                .in_("id", list(set(property_by_person.values())))
                .execute()
                .data
                or []
            )
            titles = {p["id"]: p.get("title") for p in props}
    except Exception:  # noqa: BLE001 - labels are a nicety, the list is not
        return

    for row in rows:
        cid = row.get("contact_id")
        row["contact_name"] = names.get(cid) if cid else None
        prop_id = property_by_person.get(cid) if cid else None
        row["property_title"] = titles.get(prop_id) if prop_id else None


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
    if payload.archived is not None:
        updates["archived_at"] = _now() if payload.archived else None
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
        # tenant-safe: row resolved by primary key from a tenant-scoped read
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


class LinkContactRequest(BaseModel):
    """Attach an unidentified thread to a person we already know."""

    contact_id: UUID


@router.post("/conversations/{conversation_id}/contact")
async def link_conversation_contact(
    conversation_id: UUID,
    payload: LinkContactRequest,
    tenant_id: UUID = Depends(get_tenant_id),
) -> dict:
    """Point a thread at a person, and file the number under them.

    Both halves matter: without the phone row the next message from that same
    number lands unidentified all over again.
    """
    db = get_supabase_client()
    conv = (
        db.table("client_conversations")
        .select("id,external_phone_e164")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(conversation_id))
        .single()
        .execute()
        .data
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    contact = (
        db.table("contacts")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(payload.contact_id))
        .limit(1)
        .execute()
        .data
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    e164 = to_e164(conv.get("external_phone_e164"))
    if e164:
        db.table("contact_phones").upsert(
            {
                "tenant_id": str(tenant_id),
                "contact_id": str(payload.contact_id),
                "e164": e164,
                "label": "WhatsApp",
            },
            on_conflict="contact_id,e164",
        ).execute()

    row = (
        db.table("client_conversations")
        .update({"contact_id": str(payload.contact_id)})
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(conversation_id))
        .execute()
        .data[0]
    )
    return row


class ConversationTargetRequest(BaseModel):
    """What the thread is about."""

    target_kind: str = Field(pattern="^(PROPERTY|OPPORTUNITY)$")
    property_id: UUID | None = None
    opportunity_id: UUID | None = None


@router.get("/conversations/{conversation_id}/targets")
async def list_conversation_targets(
    conversation_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> list[dict]:
    return (
        get_supabase_client()
        .table("conversation_targets")
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .eq("conversation_id", str(conversation_id))
        .execute()
        .data
        or []
    )


@router.post("/conversations/{conversation_id}/targets", status_code=201)
async def add_conversation_target(
    conversation_id: UUID,
    payload: ConversationTargetRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Say what a thread is about.

    Until now the inbox inferred it in the browser by joining a contact's open
    opportunities to properties and taking the first — a guess presented as a
    fact, and wrong the moment somebody asks about two properties.
    """
    if payload.target_kind == "PROPERTY" and not payload.property_id:
        raise HTTPException(status_code=422, detail="property_id required for PROPERTY")
    if payload.target_kind == "OPPORTUNITY" and not payload.opportunity_id:
        raise HTTPException(status_code=422, detail="opportunity_id required for OPPORTUNITY")

    row = (
        get_supabase_client()
        .table("conversation_targets")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "conversation_id": str(conversation_id),
                "target_kind": payload.target_kind,
                "property_id": str(payload.property_id) if payload.property_id else None,
                "opportunity_id": str(payload.opportunity_id) if payload.opportunity_id else None,
                "created_by": str(current_user["id"]),
            }
        )
        .execute()
        .data[0]
    )
    return row


@router.delete("/conversations/{conversation_id}/targets/{target_id}", status_code=204)
async def remove_conversation_target(
    conversation_id: UUID,
    target_id: UUID,
    tenant_id: UUID = Depends(get_tenant_id),
) -> None:
    (
        get_supabase_client()
        .table("conversation_targets")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("conversation_id", str(conversation_id))
        .eq("id", str(target_id))
        .execute()
    )


@router.get("/templates")
async def list_templates(tenant_id: UUID = Depends(get_tenant_id)) -> list[dict]:
    """Approved templates for this tenant.

    Outside the 24 h free-form window a template is the ONLY thing that can be
    sent, so this is the difference between answering a client and not. The
    inbox used to simply disable the composer and leave the broker with nothing.
    """
    from app.features.notifications.whatsapp import templates as tmpl

    return tmpl.list_for_tenant(str(tenant_id))


class SendTemplateRequest(BaseModel):
    template_name: str
    #: Positional variables, in the order the template declares them.
    variables: dict[str, str] = Field(default_factory=dict)


@router.post("/conversations/{conversation_id}/send-template")
async def send_template(
    conversation_id: UUID,
    payload: SendTemplateRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    """Send an approved template to a thread whose window has closed."""
    from app.features.notifications.whatsapp.dispatcher import (
        ConsentError,
        send_template_to_contact,
    )

    conv = (
        get_supabase_client()
        .table("client_conversations")
        .select("contact_id, external_phone_e164")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(conversation_id))
        .single()
        .execute()
        .data
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not conv.get("contact_id"):
        # A template is a marketing-regulated send; it needs a data subject,
        # not a phone number.
        raise HTTPException(status_code=409, detail="Identify the conversation first")

    try:
        return await send_template_to_contact(
            tenant_id,
            conv["contact_id"],
            conv["external_phone_e164"],
            payload.template_name,
            payload.variables,
            sender_user_id=str(current_user["id"]),
        )
    except ConsentError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Template not found") from exc
