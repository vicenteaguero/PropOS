from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.notifications.email.client import send_email

THREADS = "email_threads"
MESSAGES = "email_messages"


class EmailSyncService:
    @staticmethod
    async def list_threads(
        tenant_id: UUID, status: str | None = None, contact_id: UUID | None = None, q: str | None = None
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(THREADS)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("last_message_at", desc=True)
            .limit(200)
        )
        if status:
            builder = builder.eq("status", status)
        if contact_id is not None:
            builder = builder.eq("contact_id", str(contact_id))
        if q:
            builder = builder.ilike("subject", f"%{q}%")
        return builder.execute().data

    @staticmethod
    async def get_thread(thread_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        thread = (
            client.table(THREADS)
            .select("*")
            .eq("id", str(thread_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        messages = (
            client.table(MESSAGES)
            .select("*")
            .eq("thread_id", str(thread_id))
            .eq("tenant_id", str(tenant_id))
            .order("sent_at", desc=False)
            .execute()
            .data
        )
        thread["messages"] = messages
        return thread

    @staticmethod
    async def archive_thread(thread_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(THREADS)
            .update({"status": "ARCHIVED"})
            .eq("id", str(thread_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )

    @staticmethod
    async def reply(thread_id: UUID, tenant_id: UUID, body: str, subject: str | None, account_email: str) -> dict:
        """Send a reply threaded onto the latest inbound message and persist it."""
        client = get_supabase_client()
        thread = (
            client.table(THREADS)
            .select("*")
            .eq("id", str(thread_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        last_in = (
            client.table(MESSAGES)
            .select("message_id, references_ids, subject, account_id")
            .eq("thread_id", str(thread_id))
            .eq("direction", "IN")
            .order("sent_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        in_reply_to = last_in[0]["message_id"] if last_in else None
        references = (last_in[0].get("references_ids") or []) if last_in else []
        if in_reply_to and in_reply_to not in references:
            references = [*references, in_reply_to]

        to_email = thread.get("counterpart_email")
        reply_subject = subject or (f"Re: {thread.get('subject')}" if thread.get("subject") else "Re:")
        headers = {}
        if in_reply_to:
            headers["In-Reply-To"] = in_reply_to
        if references:
            headers["References"] = " ".join(references)

        resend_id = await send_email(
            to=to_email,
            subject=reply_subject,
            html=f"<p>{body}</p>",
            text=body,
            reply_to=account_email,
            from_override=account_email,
            headers=headers or None,
        )

        now = datetime.now(UTC).isoformat()
        row = (
            client.table(MESSAGES)
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "account_id": thread["account_id"],
                    "thread_id": str(thread_id),
                    "direction": "OUT",
                    "message_id": f"resend-{resend_id}",
                    "in_reply_to": in_reply_to,
                    "references_ids": references,
                    "from_email": account_email,
                    "to_emails": [to_email] if to_email else [],
                    "subject": reply_subject,
                    "body_text": body,
                    "sent_at": now,
                    "resend_id": resend_id,
                }
            )
            .execute()
            .data[0]
        )
        client.table(THREADS).update(
            {"last_message_at": now, "message_count": (thread.get("message_count") or 0) + 1}
        ).eq("id", str(thread_id)).execute()
        return row
