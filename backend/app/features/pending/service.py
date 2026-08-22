from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.agent.attribution import agent_attribution
from app.features.pending.overrides import sanitize_overrides
from app.features.pending.undo import undo_accepted

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


#: Hard ceiling on one page. The queue is reviewed, not scrolled.
_MAX_PAGE = 50

#: Anything older than this with no deadline is backlog, not news.
_RECENT_HOURS = 24


def _cutoff(hours: int) -> str:
    return (datetime.now(UTC) - timedelta(hours=hours)).isoformat()


#: See `PendingService.list_proposals`. Each takes and returns a PostgREST
#: builder, so the filter and its order travel together — splitting them is how
#: a "recent" query ends up sorted by a column it excluded.
_BUCKETS: dict[str, Callable[[Any], Any]] = {
    "urgent": lambda q: q.not_.is_("expires_at", "null").order("expires_at"),
    "recent": lambda q: q.is_("expires_at", "null")
    .gte("created_at", _cutoff(_RECENT_HOURS))
    .order("created_at", desc=True),
    "old": lambda q: q.is_("expires_at", "null")
    .lt("created_at", _cutoff(_RECENT_HOURS))
    .order("created_at", desc=True),
}


class PendingService:
    @staticmethod
    async def list_proposals(
        tenant_id: UUID,
        status: str | None = None,
        kind: str | None = None,
        bucket: str = "all",
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        """The queue, in three groups because one flat order buries the recent.

        Sorting everything by `expires_at` alone puts a proposal made ten
        minutes ago from a voice note (no deadline) below one that expires
        tomorrow. Sorting everything by `created_at` is what the queue did
        before, and it ignored the clock entirely. So:

        - `urgent`  — has a deadline, soonest first. Something is running out.
        - `recent`  — no deadline, made in the last 24 h, newest first.
        - `old`     — no deadline and older than that. Paged behind a button;
                      nothing about it changes if it waits another day.

        `bucket` only means anything for pending proposals: an accepted one has
        no deadline semantics, so those come back most-recently-decided first.
        """
        client = get_supabase_client()
        builder = client.table(PENDING_TABLE).select("*").eq("tenant_id", str(tenant_id))
        if status:
            builder = builder.eq("status", status)
        if kind:
            builder = builder.eq("kind", kind)

        if status == "pending" and bucket in _BUCKETS:
            builder = _BUCKETS[bucket](builder)
        elif status in ("accepted", "rejected"):
            builder = builder.order("reviewed_at", desc=True).order("created_at", desc=True)
        else:
            builder = builder.order("created_at", desc=True)

        limit = max(1, min(limit, _MAX_PAGE))
        offset = max(0, offset)
        return builder.range(offset, offset + limit - 1).execute().data

    @staticmethod
    async def undo_proposal(proposal_id: UUID, tenant_id: UUID, reviewer_user: UUID) -> dict:
        """Reverse an accepted proposal and put it back in the queue.

        Destructive by design — see undo.py for the audit guard that decides
        whether it is safe. The record is reversed FIRST: returning the proposal
        to `pending` while the row it created still exists would let a second
        accept duplicate it.
        """
        proposal = await PendingService.get_proposal(proposal_id, tenant_id)
        if proposal["status"] != "accepted":
            raise ValueError("Sólo se puede deshacer una propuesta aceptada.")

        note = undo_accepted(proposal, tenant_id)

        client = get_supabase_client()
        updated = (
            client.table(PENDING_TABLE)
            .update(
                {
                    "status": "pending",
                    "reviewer_user": str(reviewer_user),
                    "reviewed_at": None,
                    "review_note": None,
                    "review_reason": None,
                    "created_row_id": None,
                    "target_row_id": None,
                }
            )
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            # Claim-first, like accept: two taps must not undo twice.
            .eq("status", "accepted")
            .execute()
        )
        if not updated.data:
            raise ValueError("Esta propuesta ya se había deshecho.")
        logger.info("proposal_undone", extra={"proposal_id": str(proposal_id), "note": note})
        return updated.data[0]

    @staticmethod
    async def reopen_proposal(proposal_id: UUID, tenant_id: UUID) -> dict:
        """Put a rejected proposal back in the queue.

        Nothing was written when it was rejected, so this only clears the review
        and there is nothing to reverse.
        """
        client = get_supabase_client()
        updated = (
            client.table(PENDING_TABLE)
            .update(
                {
                    "status": "pending",
                    "reviewer_user": None,
                    "reviewed_at": None,
                    "review_note": None,
                    "review_reason": None,
                }
            )
            .eq("id", str(proposal_id))
            .eq("tenant_id", str(tenant_id))
            .eq("status", "rejected")
            .execute()
        )
        if not updated.data:
            raise ValueError("Sólo se puede reabrir una propuesta rechazada.")
        return updated.data[0]

    @staticmethod
    async def count_pending(tenant_id: UUID) -> int:
        """Exact count, independent of any page size."""
        res = (
            get_supabase_client()
            .table(PENDING_TABLE)
            .select("id", count="exact")
            .eq("tenant_id", str(tenant_id))
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        return res.count or 0

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
