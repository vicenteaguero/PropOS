"""IMAP poll → parse → thread portal leads into the CRM.

Driven by the Cloud Scheduler job (POST /internal/jobs/email-sync). imaplib
is blocking, so the whole batch runs in a worker thread. v0.1.0 syncs a
single mailbox configured via env (settings.email_imap_*). Incremental via
UID cursor; batch-capped per run to stay inside the Cloud Run request window.
"""

from __future__ import annotations

import email
import imaplib
from dataclasses import asdict
from email.header import decode_header, make_header
from email.utils import getaddresses, parsedate_to_datetime
from typing import Any

import anyio

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.email_sync.parsers import ParsedLead, classify_email, normalize_phone

logger = get_logger("EMAIL_SYNC")

BATCH_CAP = 200


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:  # noqa: BLE001
        return value


def _body_text(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:  # noqa: BLE001
                    continue
        return ""
    try:
        return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "replace")
    except Exception:  # noqa: BLE001
        return msg.get_payload() or ""


def _ensure_account(client, tenant_id: str) -> dict[str, Any]:
    existing = (
        client.table("email_accounts")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("email_address", settings.email_imap_user)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        return existing[0]
    return (
        client.table("email_accounts")
        .insert(
            {
                "tenant_id": tenant_id,
                "label": "Titan",
                "email_address": settings.email_imap_user,
                "username": settings.email_imap_user,
                "imap_host": settings.email_imap_host,
                "imap_port": settings.email_imap_port,
            }
        )
        .execute()
        .data[0]
    )


def _match_or_create_contact(
    client,
    tenant_id: str,
    *,
    email: str | None = None,
    name: str | None = None,
    phone: str | None = None,
) -> str | None:
    """Find the person behind a message, or create them.

    Matching goes phone-first: portal leads share the portal's no-reply
    address, so keying on e-mail alone collapses every buyer of a portal into
    one contact. The phone is the identity the broker actually calls.
    """
    if not (email or phone or name):
        return None

    base = client.table("contacts").select("id").eq("tenant_id", tenant_id).is_("deleted_at", "null")
    key = normalize_phone(phone)
    if key:
        found = base.ilike("phone", f"%{key}").limit(1).execute().data
        if found:
            return found[0]["id"]
    if email:
        base = client.table("contacts").select("id").eq("tenant_id", tenant_id).is_("deleted_at", "null")
        found = base.eq("email", email).limit(1).execute().data
        if found:
            return found[0]["id"]

    # Deterministic parse → auto-create the lead (not human-gated).
    row = {
        "tenant_id": tenant_id,
        "full_name": name or email or phone,
        "type": "BUYER",
        "source": "import",
    }
    if email:
        row["email"] = email
    if phone:
        row["phone"] = phone
    created = client.table("contacts").insert(row).execute().data[0]
    return created["id"]


def _lead_identity(lead: ParsedLead | None) -> dict[str, str | None] | None:
    """The buyer's own contact details, when the parser found any."""
    if not lead:
        return None
    if not (lead.contact_email or lead.contact_phone or lead.contact_name):
        return None
    return {"email": lead.contact_email, "name": lead.contact_name, "phone": lead.contact_phone}


def _is_duplicate(exc: Exception) -> bool:
    """True when an insert failed because the row already exists (safe to skip)."""
    s = str(exc).lower()
    return "duplicate key" in s or "23505" in s or "already exists" in s


def _sync_account_blocking(account: dict[str, Any], tenant_id: str) -> dict[str, int]:
    client = get_supabase_client()
    imap = imaplib.IMAP4_SSL(account["imap_host"], account["imap_port"])
    imap.login(settings.email_imap_user, settings.email_imap_password)
    try:
        imap.select(account.get("folder") or "INBOX", readonly=True)
        last_uid = int(account.get("last_seen_uid") or 0)
        typ, data = imap.uid("search", None, f"UID {last_uid + 1}:*")
        if typ != "OK":
            return {"fetched": 0, "leads": 0}
        uids = sorted(int(u) for u in data[0].split() if int(u) > last_uid)[:BATCH_CAP]

        fetched = 0
        leads = 0
        # Advance the cursor only across a contiguous run of persisted UIDs. A
        # fetch failure or a real (non-duplicate) insert error blocks it so that
        # message — and every UID after it — is retried next run instead of being
        # silently skipped past (the lead-loss bug).
        committed_uid = last_uid
        blocked = False
        for uid_int in uids:
            typ, msg_data = imap.uid("fetch", str(uid_int), "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                blocked = True
                continue
            msg = email.message_from_bytes(msg_data[0][1])

            subject = _decode(msg.get("Subject"))
            from_pairs = getaddresses([msg.get("From", "")])
            from_name = _decode(from_pairs[0][0]) if from_pairs else ""
            from_email = (from_pairs[0][1] if from_pairs else "").lower()
            body = _body_text(msg)
            message_id = (msg.get("Message-ID") or f"uid-{uid_int}@{account['id']}").strip()
            references = (msg.get("References") or "").split()
            in_reply_to = (msg.get("In-Reply-To") or "").strip() or None
            try:
                sent_at = parsedate_to_datetime(msg.get("Date")).isoformat()
            except Exception:  # noqa: BLE001
                sent_at = None

            lead = classify_email(subject, body, from_email)
            portal = lead.portal if lead else None
            # A portal lead is *about* someone; the From: header is the portal.
            identity = _lead_identity(lead) or {"email": from_email, "name": from_name, "phone": None}
            contact_id = _match_or_create_contact(client, tenant_id, **identity)

            # Thread: follow References to a known root, else subject+counterpart.
            root_id = references[0] if references else (in_reply_to or message_id)
            thread = (
                client.table("email_threads")
                .select("*")
                .eq("tenant_id", tenant_id)
                .eq("root_message_id", root_id)
                .limit(1)
                .execute()
                .data
            )
            if thread:
                thread_row = thread[0]
            else:
                thread_row = (
                    client.table("email_threads")
                    .insert(
                        {
                            "tenant_id": tenant_id,
                            "account_id": account["id"],
                            "subject": subject,
                            "root_message_id": root_id,
                            "counterpart_email": from_email,
                            "counterpart_name": from_name,
                            "contact_id": contact_id,
                            "first_message_at": sent_at,
                            "last_message_at": sent_at,
                            "is_lead": bool(lead),
                            "portal": portal,
                        }
                    )
                    .execute()
                    .data[0]
                )

            # Idempotent on (account_id, message_id).
            try:
                client.table("email_messages").insert(
                    {
                        "tenant_id": tenant_id,
                        "account_id": account["id"],
                        "thread_id": thread_row["id"],
                        "direction": "IN",
                        "message_id": message_id,
                        "in_reply_to": in_reply_to,
                        "references_ids": references,
                        "from_email": from_email,
                        "from_name": from_name,
                        "subject": subject,
                        "body_text": body[:20000],
                        "snippet": body[:160],
                        "sent_at": sent_at,
                        "imap_uid": uid_int,
                        "is_lead_email": bool(lead),
                        "portal": portal,
                        "parsed_lead": asdict(lead) if lead else None,
                        "contact_id": contact_id,
                    }
                ).execute()
                fetched += 1
                if lead:
                    leads += 1
                if not blocked:
                    committed_uid = uid_int
            except Exception as exc:  # noqa: BLE001
                if _is_duplicate(exc):
                    # Already persisted on a prior run — safe to advance past.
                    logger.info("email_dup_skip", message_id=message_id, error=str(exc)[:120])
                    if not blocked:
                        committed_uid = uid_int
                else:
                    # Real failure: stop advancing so this UID is retried next run.
                    logger.warning("email_insert_failed", message_id=message_id, error=str(exc)[:200])
                    blocked = True

        client.table("email_accounts").update(
            {"last_seen_uid": committed_uid, "last_synced_at": "now()", "last_error": None}
        ).eq("id", account["id"]).execute()
        return {"fetched": fetched, "leads": leads}
    finally:
        try:
            imap.logout()
        except Exception:  # noqa: BLE001
            pass


async def run_all_active_accounts() -> dict[str, int]:
    if not settings.email_sync_enabled or not settings.email_imap_password or not settings.email_sync_tenant_id:
        logger.info("email_sync_disabled", event_type="job")
        return {"fetched": 0, "leads": 0}

    tenant_id = settings.email_sync_tenant_id
    client = get_supabase_client()
    account = _ensure_account(client, tenant_id)
    try:
        result = await anyio.to_thread.run_sync(_sync_account_blocking, account, tenant_id)
    except Exception as exc:  # noqa: BLE001
        client.table("email_accounts").update({"last_error": str(exc)[:300]}).eq("id", account["id"]).execute()
        logger.error("email_sync_failed", event_type="error", error=str(exc)[:300])
        return {"fetched": 0, "leads": 0}
    logger.info("email_sync_done", event_type="job", **result)
    return result
