from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

PENDING_TABLE = "pending_proposals"

logger = get_logger("PENDING")


# Registry: tool kind → executor that performs the actual mutation.
# Populated in Phase E by app.features.anita.tools.executors when each
# propose_* executor is implemented. Signature:
#   executor(payload: dict, tenant_id: UUID, user_id: UUID,
#            anita_session_id: UUID) -> tuple[str, UUID]
# returning (target_table, created_row_id).
ACCEPT_DISPATCHERS: dict[str, Callable[..., tuple[str, UUID]]] = {}


def register_accept_dispatcher(
    kind: str,
    fn: Callable[..., tuple[str, UUID]],
) -> None:
    ACCEPT_DISPATCHERS[kind] = fn


class PendingService:
    @staticmethod
    async def list_proposals(
        tenant_id: UUID,
        status: str | None = None,
        kind: str | None = None,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(PENDING_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
        )
        if status:
            builder = builder.eq("status", status)
        if kind:
            builder = builder.eq("kind", kind)
        return builder.execute().data

    @staticmethod
    async def get_proposal(proposal_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(PENDING_TABLE)
            .select("*")
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def reject_proposal(
        proposal_id: UUID,
        tenant_id: UUID,
        reviewer_user: UUID,
        reason: str | None,
    ) -> dict:
        client = get_supabase_client()
        from datetime import UTC, datetime

        update = {
            "status": "rejected",
            "reviewer_user": str(reviewer_user),
            "reviewed_at": datetime.now(UTC).isoformat(),
            "review_note": reason,
        }
        response = (
            client.table(PENDING_TABLE)
            .update(update)
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        logger.info(
            "rejected",
            event_type="write",
            proposal_id=str(proposal_id),
            reason=reason,
        )
        return response.data[0]

    @staticmethod
    async def accept_proposal(
        proposal_id: UUID,
        tenant_id: UUID,
        reviewer_user: UUID,
        overrides: dict[str, Any] | None = None,
        disambiguation: dict[str, UUID] | None = None,
        note: str | None = None,
    ) -> dict:
        client = get_supabase_client()
        proposal = await PendingService.get_proposal(proposal_id, tenant_id)

        if proposal["status"] != "pending":
            raise ValueError(
                f"Proposal {proposal_id} not pending (status={proposal['status']})"
            )

        kind = proposal["kind"]
        dispatcher = ACCEPT_DISPATCHERS.get(kind)
        if dispatcher is None:
            # Phase A: dispatcher registry empty until Phase E executors land.
            # Returning 501 honestly beats faking success.
            raise NotImplementedError(
                f"Accept dispatcher for kind '{kind}' not registered yet "
                "(Phase E wires propose_* executors)."
            )

        payload: dict[str, Any] = dict(proposal["resolved_payload"] or proposal["payload"])
        if overrides:
            payload.update(overrides)
        if disambiguation:
            for key, chosen_id in disambiguation.items():
                payload[key] = str(chosen_id)

        # Stamp PostgREST headers so the universal audit_log trigger
        # records source='anita' + anita_session_id (see migration 0033).
        anita_session_id = UUID(proposal["anita_session_id"])
        postgrest_headers = client.postgrest.session.headers
        postgrest_headers["X-Anita-Session-Id"] = str(anita_session_id)
        postgrest_headers["X-Action-Source"] = "anita"
        try:
            target_table, created_row_id = dispatcher(
                payload=payload,
                tenant_id=tenant_id,
                user_id=reviewer_user,
                anita_session_id=anita_session_id,
            )
        finally:
            postgrest_headers.pop("X-Anita-Session-Id", None)
            postgrest_headers.pop("X-Action-Source", None)

        from datetime import UTC, datetime

        update = {
            "status": "accepted",
            "reviewer_user": str(reviewer_user),
            "reviewed_at": datetime.now(UTC).isoformat(),
            "review_note": note,
            "target_table": target_table,
            "created_row_id": str(created_row_id),
        }
        response = (
            client.table(PENDING_TABLE)
            .update(update)
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        logger.info(
            "accepted",
            event_type="write",
            proposal_id=str(proposal_id),
            target_table=target_table,
            created_row_id=str(created_row_id),
        )
        return response.data[0]
