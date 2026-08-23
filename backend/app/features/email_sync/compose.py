"""Outbound compose: start a brand-new email thread from PropOS.

`EmailSyncService.reply` can only answer someone who wrote first, so a broker's
first contact by email had to happen outside the product. This module sends via
Resend and persists the thread, keeping first contact inside the CRM trail.

No IMAP involved: delivery is Resend's, and a tenant with no mailbox configured
still gets a usable outbound path.
"""

from __future__ import annotations

from datetime import UTC, datetime
from email.utils import parseaddr
from html import escape
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.compliance.service import PURPOSE_EMAIL, ComplianceService
from app.features.notifications.email.client import send_email

ACCOUNTS = "email_accounts"
THREADS = "email_threads"
MESSAGES = "email_messages"
CONTACTS = "contacts"

logger = get_logger("EMAIL_COMPOSE")


class SendEmailRequest(BaseModel):
    to: EmailStr
    subject: str
    body: str
    contact_id: UUID | None = None


def _as_html(body: str) -> str:
    """Escape the broker's plain text and keep its line breaks."""
    lines = [escape(line) for line in body.splitlines()] or [""]
    return f"<p>{'<br>'.join(lines)}</p>"


def _platform_sender() -> str:
    """Bare address out of `resend_from_email`, which may carry a display name."""
    return parseaddr(settings.resend_from_email)[1] or settings.resend_from_email


def _sender_address(client: Any | None = None, tenant_id: UUID | str | None = None) -> str:
    """The address a tenant's outbound mail is signed with.

    Three levels, in order: the tenant's own configured sender, then the
    platform address, and nothing else.

    The platform address is the LAST resort on purpose. `RESEND_FROM_EMAIL` is a
    single global value and PropOS is multi-tenant, so falling straight back to
    it means a message to one brokerage's client goes out signed by the product
    -- or, before propos.cl existed, by a different brokerage's domain. Whatever
    a tenant sends to its own clients has to carry the tenant's identity.

    Resend refuses a `From` on an unverified domain, so a tenant sender only
    works once that domain is verified in the Resend account. That is a setup
    step, not something this function can paper over.
    """
    if client is None or tenant_id is None:
        return _platform_sender()
    try:
        rows = client.table("tenants").select("settings").eq("id", str(tenant_id)).limit(1).execute().data
    except Exception:  # noqa: BLE001
        return _platform_sender()
    if rows:
        configured = (rows[0].get("settings") or {}).get("email_from")
        if configured:
            return parseaddr(configured)[1] or configured
    return _platform_sender()


def _resolve_account(client: Any, tenant_id: UUID) -> dict:
    """Account to attribute the thread to. Prefers a real mailbox, else Resend.

    `email_threads.account_id` is NOT NULL, so an outbound-only tenant still
    needs a row. The fallback is stored inactive on purpose: the IMAP poller
    must never try to log into an address that has no mailbox behind it.
    """
    active = (
        client.table(ACCOUNTS)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .eq("is_active", True)
        .is_("deleted_at", "null")
        .order("created_at")
        .limit(1)
        .execute()
        .data
    )
    if active:
        return active[0]

    sender = _sender_address(client, tenant_id)
    existing = (
        client.table(ACCOUNTS)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .eq("email_address", sender)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return existing[0]
    return (
        client.table(ACCOUNTS)
        .insert(
            {
                "tenant_id": str(tenant_id),
                "label": "Resend",
                "email_address": sender,
                "username": sender,
                "is_active": False,
            }
        )
        .execute()
        .data[0]
    )


def _resolve_contact(client: Any, tenant_id: UUID, contact_id: UUID | None, recipient: str) -> dict | None:
    """Contact that owns `recipient`, so consent is checked against the real addressee.

    A `contact_id` whose email does not match the recipient is ignored — it
    would otherwise attach the thread (and the consent decision) to the wrong
    data subject.
    """
    if contact_id is not None:
        picked = (
            client.table(CONTACTS)
            .select("id, full_name, email")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
            .data
        )
        if picked and (picked[0].get("email") or "").lower() == recipient.lower():
            return picked[0]

    matched = (
        client.table(CONTACTS)
        .select("id, full_name, email")
        .eq("tenant_id", str(tenant_id))
        .ilike("email", recipient)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
        .data
    )
    return matched[0] if matched else None


class EmailComposeService:
    @staticmethod
    async def send(
        tenant_id: UUID,
        to: str,
        subject: str,
        body: str,
        contact_id: UUID | None = None,
    ) -> dict:
        """Send a first-contact email and persist it as a new OPEN thread."""
        db = get_supabase_client()
        recipient = to.strip()
        account = _resolve_account(db, tenant_id)
        contact = _resolve_contact(db, tenant_id, contact_id, recipient)

        # Same gate the reply path enforces (Ley 21.719 Art. 14): a blocked or
        # objecting subject does not receive mail, whoever starts the thread.
        if contact:
            await ComplianceService.assert_can_process(contact["id"], tenant_id, PURPOSE_EMAIL)

        from_email = account["email_address"] if account.get("is_active") else None
        resend_id = await send_email(
            to=recipient,
            subject=subject,
            html=_as_html(body),
            text=body,
            reply_to=from_email,
            from_override=from_email,
        )

        now = datetime.now(UTC).isoformat()
        thread = (
            db.table(THREADS)
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "account_id": account["id"],
                    "subject": subject,
                    "counterpart_email": recipient,
                    "counterpart_name": contact.get("full_name") if contact else None,
                    "contact_id": contact["id"] if contact else None,
                    "first_message_at": now,
                    "last_message_at": now,
                    "message_count": 1,
                    "is_lead": False,
                    "status": "OPEN",
                }
            )
            .execute()
            .data[0]
        )
        db.table(MESSAGES).insert(
            {
                "tenant_id": str(tenant_id),
                "account_id": account["id"],
                "thread_id": thread["id"],
                "direction": "OUT",
                "message_id": f"resend-{resend_id}",
                "from_email": from_email or _sender_address(db, tenant_id),
                "to_emails": [recipient],
                "subject": subject,
                "body_text": body,
                "sent_at": now,
                "resend_id": resend_id,
                "contact_id": contact["id"] if contact else None,
            }
        ).execute()

        logger.info(
            "compose_sent",
            event_type="write",
            tenant_id=str(tenant_id),
            thread_id=thread["id"],
            resend_id=resend_id,
        )
        return thread
