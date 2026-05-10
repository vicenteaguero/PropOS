from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

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


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


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

        # media_files has no direct contact_id link in current schema.
        # Files associated to the subject would typically be linked through
        # interactions (interaction_targets) or documents. For minimal export
        # we omit them here; documents endpoint can supply them per request.
        media_files: list[dict[str, Any]] = []

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
        )
