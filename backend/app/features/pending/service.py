from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.agent.attribution import agent_attribution
from app.features.pending.overrides import sanitize_overrides

PENDING_TABLE = "pending_proposals"

logger = get_logger("PENDING")

# Registry: tool kind → executor that performs the actual mutation.
# Populated in Phase E by app.features.agent.tools.executors when each
# propose_* executor is implemented. Signature:
#   executor(payload: dict, tenant_id: UUID, user_id: UUID,
#            agent_session_id: UUID) -> tuple[str, UUID]
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
        builder = client.table(PENDING_TABLE).select("*").eq("tenant_id", str(tenant_id)).order("created_at", desc=True)
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
        review_reason: str | None = None,
    ) -> dict:
        client = get_supabase_client()
        from datetime import UTC, datetime

        update = {
            "status": "rejected",
            "reviewer_user": str(reviewer_user),
            "reviewed_at": datetime.now(UTC).isoformat(),
            "review_note": reason,
            "review_reason": review_reason,
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
            raise ValueError(f"Proposal {proposal_id} not pending (status={proposal['status']})")

        kind = proposal["kind"]
        dispatcher = ACCEPT_DISPATCHERS.get(kind)
        if dispatcher is None:
            # Phase A: dispatcher registry empty until Phase E executors land.
            # Returning 501 honestly beats faking success.
            raise NotImplementedError(
                f"Accept dispatcher for kind '{kind}' not registered yet (Phase E wires propose_* executors)."
            )

        payload: dict[str, Any] = dict(proposal["resolved_payload"] or proposal["payload"])
        # Whitelisted against the intent's own declaration. This was a bare
        # `payload.update(overrides)`, so a hand-made request body wrote any
        # column it liked into the row the executor inserts. See overrides.py.
        payload.update(sanitize_overrides(kind, overrides))
        if disambiguation:
            for key, chosen_id in disambiguation.items():
                payload[key] = str(chosen_id)

        from datetime import UTC, datetime

        # Claim-first, like `jobs/service.run_due_reminders`. The status check
        # above is a read, so a double click (or a retry after a timeout, or two
        # tabs) could run the dispatcher twice and create two domain rows from
        # one proposal. Flipping pending->accepted in a single filtered UPDATE
        # means only one caller can proceed.
        reviewed_at = datetime.now(UTC).isoformat()
        claimed = (
            client.table(PENDING_TABLE)
            .update({"status": "accepted", "reviewer_user": str(reviewer_user), "reviewed_at": reviewed_at})
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            .eq("status", "pending")
            .execute()
            .data
        )
        if not claimed:
            raise ValueError(f"Proposal {proposal_id} is already being accepted")

        # Attribution for the universal audit_log trigger (migration 0033).
        # Shared with the dispatcher's auto-commit path.
        agent_session_id = UUID(proposal["agent_session_id"])
        try:
            with agent_attribution(agent_session_id):
                target_table, created_row_id = dispatcher(
                    payload=payload,
                    tenant_id=tenant_id,
                    user_id=reviewer_user,
                    agent_session_id=agent_session_id,
                )
        except Exception:
            # Release the claim so the user can fix the payload and retry
            # instead of being left with a proposal marked accepted that wrote
            # nothing.
            client.table(PENDING_TABLE).update({"status": "pending", "reviewer_user": None, "reviewed_at": None}).eq(
                "id", str(proposal_id)
            ).eq("tenant_id", str(tenant_id)).eq("status", "accepted").execute()
            raise

        update = {
            "status": "accepted",
            "reviewer_user": str(reviewer_user),
            "reviewed_at": reviewed_at,
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
