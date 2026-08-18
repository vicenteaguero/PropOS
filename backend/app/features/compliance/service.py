from __future__ import annotations

import ipaddress
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import UUID

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.compliance.schemas import (
    ConsentEvidence,
    ConsentGrantRequest,
    ConsentRevokeRequest,
    ConsentState,
    SubjectExport,
)

CONTACTS_TABLE = "contacts"

logger = get_logger("COMPLIANCE")


# ---------------------------------------------------------------------------
# Purposes (Art. 12 — consent is per-finalidad, not a single global flag)
# ---------------------------------------------------------------------------

PURPOSE_OPERATIONAL = "operacional"
PURPOSE_MARKETING = "marketing"
PURPOSE_EMAIL = "email"
PURPOSE_WHATSAPP = "whatsapp"

#: Purposes that cannot run on contract / legitimate interest. Processing for
#: one of these without a recorded grant is denied outright.
CONSENT_REQUIRED_PURPOSES = frozenset({PURPOSE_MARKETING, PURPOSE_EMAIL, PURPOSE_WHATSAPP})

#: Days between an erasure and the hard purge of the subject's media. Matches
#: the grace period documented in docs/compliance/dsar-procedure.md, so a
#: mistaken erasure is still recoverable from the blob within that window.
ERASURE_MEDIA_GRACE_DAYS = 30

#: Placeholder written over the identifying columns of an erased contact. Data,
#: not code, so it renders in the broker's Spanish UI.
ERASURE_TOMBSTONE_NAME = "[Datos suprimidos]"

#: Top-level snapshot keys overwritten when redacting `audit_log`. Kept in sync
#: with `public.compliance_pii_fields()` in
#: supabase/migrations/20240601000051_retention_and_erasure.sql — this list is
#: the authority, the SQL default only covers callers that pass NULL.
PII_FIELDS: tuple[str, ...] = (
    "full_name",
    "name",
    "first_name",
    "last_name",
    "display_name",
    "email",
    "from_email",
    "to_emails",
    "cc_emails",
    "counterpart_email",
    "phone",
    "phone_e164",
    "external_phone_e164",
    "mobile",
    "rut",
    "birthdate",
    "address",
    "notes",
    "note",
    "content",
    "body_text",
    "body_html",
    "snippet",
    "subject",
    "text",
    "raw_response",
    "payload",
    "proof",
    "evidence",
    "consent",
    "metadata",
    "alias",
    "media_url",
    "url",
)

REDACTED = "[redacted]"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# ---------------------------------------------------------------------------
# Consent evaluation (Art. 12) — pure, so the gate is testable without a DB
# ---------------------------------------------------------------------------


class ConsentDeniedError(RuntimeError):
    """Processing was refused because the subject's consent does not cover it."""

    def __init__(self, contact_id: str, purpose: str, reason: str) -> None:
        super().__init__(f"contact {contact_id} may not be processed for '{purpose}': {reason}")
        self.contact_id = contact_id
        self.purpose = purpose
        self.reason = reason


@dataclass(frozen=True)
class ConsentDecision:
    allowed: bool
    reason: str


def evaluate_consent(consent: Mapping[str, Any] | None, purpose: str) -> ConsentDecision:
    """Decide whether `purpose` may run against a contact with this consent state.

    The precedence is deliberate. Erasure and a temporary block (Art. 14, the
    *bloqueo* right) stop everything including operational processing — that is
    the whole point of the right. A revocation or a purpose the subject never
    granted only stops the purposes that legally require consent; operational
    handling of an existing mandate rests on the contract, not on consent, so
    it survives.

    An absent consent record is not treated as a grant: it is exactly the state
    the audit found on most real contacts, and the finding was that they were
    being marketed to anyway.
    """
    state = dict(consent or {})

    if state.get("erased_at"):
        return ConsentDecision(False, "erased")
    if state.get("blocked_at"):
        return ConsentDecision(False, "blocked")

    required = purpose in CONSENT_REQUIRED_PURPOSES

    if not state:
        return ConsentDecision(not required, "no_consent_recorded")

    if state.get("revoked_at"):
        return ConsentDecision(not required, "revoked")

    purposes = state.get("purposes") or []
    if purpose in purposes:
        return ConsentDecision(True, "granted")
    return ConsentDecision(not required, "purpose_not_granted")


def redact_snapshot(snapshot: Mapping[str, Any] | None, fields: tuple[str, ...] = PII_FIELDS) -> dict[str, Any] | None:
    """Overwrite the PII keys of one audit snapshot with `[redacted]`.

    Mirrors `public.compliance_redact_jsonb`. Keys that are absent or already
    null are left alone: writing a placeholder over a null would claim the row
    once held a value it never held, which is a worse audit record than the
    original.
    """
    if snapshot is None:
        return None
    out = dict(snapshot)
    for key in fields:
        if key in out and out[key] is not None:
            out[key] = REDACTED
    return out


def storage_path_from_url(url: str | None) -> tuple[str, str] | None:
    """Split a Supabase Storage URL into `(bucket, object_path)`.

    Handles the public, signed and authenticated URL shapes. Returns None for
    anything that is not a Storage object URL — an external link recorded in
    `media_files.url` has no blob of ours to delete.
    """
    if not url:
        return None
    path = urlparse(url).path
    marker = "/storage/v1/object/"
    idx = path.find(marker)
    if idx == -1:
        return None
    rest = path[idx + len(marker) :].lstrip("/")
    for prefix in ("public/", "sign/", "authenticated/"):
        if rest.startswith(prefix):
            rest = rest[len(prefix) :]
            break
    bucket, _, object_path = rest.partition("/")
    if not bucket or not object_path:
        return None
    return bucket, unquote(object_path)


def client_ip_from_headers(headers: Mapping[str, str], socket_ip: str | None) -> str | None:
    """Resolve the subject's IP for consent evidence.

    Behind Cloud Run `request.client.host` is the load balancer, so the stored
    evidence proved only that our own proxy consented. Cloud Run's front end
    appends to `X-Forwarded-For` and the client address is the first entry; we
    validate it parses as an IP so a spoofed header cannot write arbitrary text
    into the evidence, and fall back to the socket when it does not.

    Not wired here on purpose: the call site is `compliance/router.py`, which
    another lane owns. Wire it as
    ``client_ip_from_headers(request.headers, request.client.host if request.client else None)``.
    """
    forwarded = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if forwarded:
        candidate = forwarded.split(",")[0].strip()
        # A bare IPv6 may arrive bracketed, and IPv4 may carry a :port.
        if candidate.startswith("[") and "]" in candidate:
            candidate = candidate[1 : candidate.index("]")]
        elif candidate.count(":") == 1:
            candidate = candidate.split(":")[0]
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            logger.warning("xff_unparseable", event_type="read", value=forwarded[:120])
    return socket_ip


# ---------------------------------------------------------------------------
# Retention sweep (Art. 14 quinquies)
# ---------------------------------------------------------------------------


async def run_retention_sweep(now: datetime | None = None) -> dict[str, int]:
    """Delete every record whose retention window has closed.

    Idempotent and safe to run twice: each step selects by an absolute cutoff,
    so a second run in the same minute finds nothing left. Windows come from
    `settings.retention_*_days`, which mirror docs/compliance/rat.yaml.

    NOT WIRED TO A SCHEDULER YET. `jobs/service.py` and Cloud Scheduler belong
    to another lane; this is the callable they need — one line in
    `jobs/router.py` plus one Cloud Scheduler job.

    media_files is purged in two steps because the row is the only pointer to
    the Storage object: read the expired rows, drop the blobs, then drop the
    rows. A crash in between leaves a row whose blob is gone, which the next
    sweep cleans up; the reverse would leave a blob nobody can find.
    """
    client = get_supabase_client()
    now = now or datetime.now(UTC)
    counts = {"media_files": 0, "media_blobs": 0, "webhook_events": 0, "transcripts": 0, "audit_log": 0}

    expired = client.rpc("compliance_expired_media", {"p_before": now.isoformat(), "p_limit": 500}).execute().data or []
    purged_ids: list[str] = []
    for row in expired:
        target = storage_path_from_url(row.get("url"))
        if target:
            bucket, object_path = target
            try:
                client.storage.from_(bucket).remove([object_path])
                counts["media_blobs"] += 1
            except Exception as exc:  # noqa: BLE001 — a missing blob must not stop the sweep
                logger.warning(
                    "media_blob_purge_failed",
                    event_type="job",
                    media_file_id=row.get("id"),
                    bucket=bucket,
                    error=str(exc)[:200],
                )
                continue
        purged_ids.append(str(row["id"]))

    if purged_ids:
        counts["media_files"] = int(
            client.rpc("compliance_purge_media_files", {"p_ids": purged_ids}).execute().data or 0
        )

    counts["webhook_events"] = int(
        client.rpc("compliance_purge_webhook_events", {"p_before": now.isoformat()}).execute().data or 0
    )
    counts["transcripts"] = int(
        client.rpc(
            "compliance_purge_agent_transcripts",
            {"p_before": (now - timedelta(days=settings.retention_agent_transcripts_days)).isoformat()},
        )
        .execute()
        .data
        or 0
    )
    counts["audit_log"] = int(
        client.rpc(
            "compliance_purge_audit_log",
            {"p_before": (now - timedelta(days=settings.retention_audit_log_days)).isoformat()},
        )
        .execute()
        .data
        or 0
    )

    logger.info("retention_sweep", event_type="job", **counts)
    return counts


class ComplianceService:
    @staticmethod
    async def record_consent(
        contact_id: UUID,
        tenant_id: UUID,
        payload: ConsentGrantRequest,
    ) -> dict[str, Any]:
        client = get_supabase_client()
        consent: dict[str, Any] = {
            "version": payload.version,
            "granted_at": _now_iso(),
            "purposes": payload.purposes,
            "evidence": payload.evidence.model_dump(exclude_none=True),
            "revoked_at": None,
            "blocked_at": None,
        }
        response = (
            client.table(CONTACTS_TABLE)
            .update({"consent": consent})
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        logger.info(
            "consent_granted",
            event_type="write",
            contact_id=str(contact_id),
            purposes=payload.purposes,
        )
        return response.data[0] if response.data else {}

    @staticmethod
    async def revoke_consent(
        contact_id: UUID,
        tenant_id: UUID,
        payload: ConsentRevokeRequest,
    ) -> dict[str, Any]:
        client = get_supabase_client()
        current = (
            client.table(CONTACTS_TABLE)
            .select("consent")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        consent: dict[str, Any] = (current.data or {}).get("consent") or {}
        if payload.purposes is None:
            consent["revoked_at"] = _now_iso()
            consent["purposes"] = []
        else:
            current_purposes: list[str] = consent.get("purposes") or []
            consent["purposes"] = [p for p in current_purposes if p not in payload.purposes]
            if not consent["purposes"]:
                consent["revoked_at"] = _now_iso()
        response = (
            client.table(CONTACTS_TABLE)
            .update({"consent": consent})
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        logger.info(
            "consent_revoked",
            event_type="write",
            contact_id=str(contact_id),
            purposes=payload.purposes,
        )
        return response.data[0] if response.data else {}

    # --- Consent enforcement -------------------------------------------------

    @staticmethod
    async def consent_decision(contact_id: UUID | str, tenant_id: UUID | str, purpose: str) -> ConsentDecision:
        """Read the stored consent and decide, without raising.

        A contact that cannot be read (wrong tenant, deleted, missing) is
        refused rather than defaulted to allowed.
        """
        client = get_supabase_client()
        rows = (
            client.table(CONTACTS_TABLE)
            .select("consent, deleted_at, erased_at")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return ConsentDecision(False, "contact_not_found")
        row = rows[0]
        if row.get("erased_at"):
            return ConsentDecision(False, "erased")
        return evaluate_consent(row.get("consent"), purpose)

    @staticmethod
    async def assert_can_process(contact_id: UUID | str, tenant_id: UUID | str, purpose: str) -> None:
        """Central gate for any processing tied to a subject.

        Raises `ConsentDeniedError`. Callers that have a fallback channel should
        catch it, the same way the WhatsApp dispatcher's `ConsentError` is
        caught today.
        """
        decision = await ComplianceService.consent_decision(contact_id, tenant_id, purpose)
        if not decision.allowed:
            logger.info(
                "processing_denied",
                event_type="read",
                contact_id=str(contact_id),
                purpose=purpose,
                reason=decision.reason,
            )
            raise ConsentDeniedError(str(contact_id), purpose, decision.reason)

    # --- Erasure (Art. 14) ---------------------------------------------------

    @staticmethod
    async def erase_subject(
        contact_id: UUID,
        tenant_id: UUID,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Execute the right to erasure end-to-end.

        Four places held the subject's data after the old soft delete, and this
        reaches all four:

        1. `contacts` becomes a tombstone — id and tenant_id survive so the
           foreign keys pointing at it stay valid, every identifying column is
           overwritten.
        2. `person_aliases` rows are dropped outright; an alias is nothing but
           a name.
        3. Media reachable from the subject's interactions (via
           `interactions.raw_transcript_id -> agent_transcripts.media_file_id`,
           the only real contact-to-media path in this schema) gets a
           `purge_after` so the next retention sweep deletes the blob.
        4. `audit_log` snapshots are redacted in place — the ledger keeps its
           rows, timestamps and actors, and loses the personal data.

        Returns the per-step counts so the DSAR file can record what was done.
        """
        client = get_supabase_client()
        now = datetime.now(UTC)
        stamp = now.isoformat()

        existing = (
            client.table(CONTACTS_TABLE)
            .select("id")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not existing:
            raise LookupError(f"contact {contact_id} not found in tenant {tenant_id}")

        tombstone = {
            "full_name": ERASURE_TOMBSTONE_NAME,
            "email": None,
            "phone": None,
            "rut": None,
            "birthdate": None,
            "address": None,
            "notes": None,
            "metadata": {},
            "consent": {
                "purposes": [],
                "revoked_at": stamp,
                "erased_at": stamp,
                "erasure_reason": reason,
            },
            "deleted_at": stamp,
            "erased_at": stamp,
        }
        client.table(CONTACTS_TABLE).update(tombstone).eq("id", str(contact_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()

        aliases_removed = (
            client.table("person_aliases")
            .delete()
            .eq("person_id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
            or []
        )

        media_ids = _subject_media_file_ids(client, contact_id, tenant_id)
        if media_ids:
            client.table("media_files").update(
                {"purge_after": (now + timedelta(days=ERASURE_MEDIA_GRACE_DAYS)).isoformat()}
            ).in_("id", media_ids).execute()

        redacted = int(
            client.rpc(
                "compliance_redact_subject_audit",
                {
                    "p_tenant_id": str(tenant_id),
                    "p_contact_id": str(contact_id),
                    "p_fields": list(PII_FIELDS),
                },
            )
            .execute()
            .data
            or 0
        )

        result = {
            "contact_id": str(contact_id),
            "erased_at": stamp,
            "aliases_deleted": len(aliases_removed),
            "media_scheduled_for_purge": len(media_ids),
            "audit_rows_redacted": redacted,
        }
        logger.info("subject_erased", event_type="write", **result)
        return result

    @staticmethod
    async def export_subject_data(
        contact_id: UUID,
        tenant_id: UUID,
    ) -> SubjectExport:
        """Bundle all data tied to a subject for ARCOPB compliance.

        Reuses table-level reads. RLS ensures cross-tenant isolation.
        Subject must live in the active tenant_id (X-Tenant-Id header).
        """
        client = get_supabase_client()

        contact_row = (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not contact_row:
            return SubjectExport(
                subject_id=contact_id,
                tenant_id=tenant_id,
                generated_at=datetime.now(UTC),
                contact={},
            )

        consent_raw = contact_row.get("consent") or {}
        evidence_raw = consent_raw.get("evidence") or None
        consent_state = ConsentState(
            version=consent_raw.get("version"),
            granted_at=consent_raw.get("granted_at"),
            purposes=consent_raw.get("purposes") or [],
            evidence=ConsentEvidence(**evidence_raw) if evidence_raw else None,
            revoked_at=consent_raw.get("revoked_at"),
            blocked_at=consent_raw.get("blocked_at"),
        )

        aliases = (
            client.table("person_aliases")
            .select("*")
            .eq("person_id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
            or []
        )

        participants = (
            client.table("interaction_participants")
            .select("*")
            .eq("person_id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
            or []
        )
        interaction_ids = list({p["interaction_id"] for p in participants if p.get("interaction_id")})
        interactions: list[dict[str, Any]] = []
        targets: list[dict[str, Any]] = []
        if interaction_ids:
            interactions = (
                client.table("interactions")
                .select("*")
                .in_("id", interaction_ids)
                .eq("tenant_id", str(tenant_id))
                .execute()
                .data
                or []
            )
            targets = (
                client.table("interaction_targets").select("*").in_("interaction_id", interaction_ids).execute().data
                or []
            )

        notes = (
            client.table("notes")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .eq("target_table", "contacts")
            .eq("target_row_id", str(contact_id))
            .execute()
            .data
            or []
        )

        # tasks soft-link via related jsonb {"people": ["uuid", ...]}
        tasks_resp = (
            client.table("tasks")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .contains("related", {"people": [str(contact_id)]})
            .execute()
        )
        tasks = tasks_resp.data or []

        # The subject's own words. Omitting these was the P3 finding: a
        # portability export without the WhatsApp thread and the transcribed
        # voice notes is missing exactly the content subjects ask for.
        conversations = (
            client.table("client_conversations")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .eq("contact_id", str(contact_id))
            .execute()
            .data
            or []
        )
        conversation_ids = [c["id"] for c in conversations if c.get("id")]
        messages: list[dict[str, Any]] = []
        if conversation_ids:
            messages = (
                client.table("client_messages")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .in_("conversation_id", conversation_ids)
                .order("created_at", desc=False)
                .execute()
                .data
                or []
            )

        consents = (
            client.table("client_consents")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .eq("contact_id", str(contact_id))
            .execute()
            .data
            or []
        )

        emails = (
            client.table("email_messages")
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .eq("contact_id", str(contact_id))
            .order("sent_at", desc=False)
            .execute()
            .data
            or []
        )

        transcript_ids = [i["raw_transcript_id"] for i in interactions if i.get("raw_transcript_id")]
        transcripts: list[dict[str, Any]] = []
        if transcript_ids:
            transcripts = (
                client.table("agent_transcripts")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .in_("id", transcript_ids)
                .execute()
                .data
                or []
            )

        # media_files has no contact_id; the reachable set is whatever the
        # subject's own interactions transcribed from.
        media_ids = [t["media_file_id"] for t in transcripts if t.get("media_file_id")]
        media_files: list[dict[str, Any]] = []
        if media_ids:
            media_files = (
                client.table("media_files")
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .in_("id", media_ids)
                .execute()
                .data
                or []
            )

        return SubjectExport(
            subject_id=contact_id,
            tenant_id=tenant_id,
            generated_at=datetime.now(UTC),
            contact=contact_row,
            consent=consent_state,
            interactions=interactions,
            interaction_targets=targets,
            notes=notes,
            tasks=tasks,
            media_files=media_files,
            aliases=aliases,
            client_conversations=conversations,
            client_messages=messages,
            channel_consents=consents,
            email_messages=emails,
            transcripts=transcripts,
        )


def _subject_media_file_ids(client: Any, contact_id: UUID, tenant_id: UUID) -> list[str]:
    """Media reachable from a subject, via their interactions' transcripts.

    `media_files` carries no contact reference, so this is the only link that
    exists in the schema rather than one invented for the occasion:
    interaction_participants -> interactions.raw_transcript_id ->
    agent_transcripts.media_file_id.
    """
    participants = (
        client.table("interaction_participants")
        .select("interaction_id")
        .eq("person_id", str(contact_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
        or []
    )
    interaction_ids = [p["interaction_id"] for p in participants if p.get("interaction_id")]
    if not interaction_ids:
        return []

    interactions = (
        client.table("interactions")
        .select("raw_transcript_id")
        .eq("tenant_id", str(tenant_id))
        .in_("id", interaction_ids)
        .execute()
        .data
        or []
    )
    transcript_ids = [i["raw_transcript_id"] for i in interactions if i.get("raw_transcript_id")]
    if not transcript_ids:
        return []

    transcripts = (
        client.table("agent_transcripts")
        .select("media_file_id")
        .eq("tenant_id", str(tenant_id))
        .in_("id", transcript_ids)
        .execute()
        .data
        or []
    )
    return [str(t["media_file_id"]) for t in transcripts if t.get("media_file_id")]
