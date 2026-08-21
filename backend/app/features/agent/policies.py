"""What Propo may do on its own.

Autonomy used to be a compile-time constant: `IntentSpec.auto_commit` defaulted
to `True` on a frozen dataclass, only two of twelve intents opted out, and
nothing anywhere could change it — not per tenant, not per user, not at
runtime. Ten kinds of write, including creating and editing people, went into
the CRM with no human ever seeing them, and `pending_proposals` was reached
only when the direct write raised.

The default here is tiered by risk rather than uniform, because the honest rule
is not "always ask" nor "never ask":

* **execute** — reversible, internal, and about something the broker just said
  out loud anyway. Dictating a note and having to approve the note is theatre.
* **suggest** — anything that touches a person's record, a deal, money, or the
  world outside the office. Getting one of these wrong costs a phone call to
  fix, or worse.

A row in `agent_action_policies` overrides the default for one tenant and one
action, so a brokerage can loosen or tighten without a deploy.
"""

from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("AGENT_POLICY")


class AutonomyLevel(StrEnum):
    #: Read and log; never write, never queue.
    OBSERVE = "observe"
    #: Queue a `pending_proposals` row and stop.
    SUGGEST = "suggest"
    #: Write the domain row directly, attributed to the agent.
    EXECUTE = "execute"


#: Reversible, internal, and already stated by the human in the same breath.
_EXECUTE_BY_DEFAULT: frozenset[str] = frozenset(
    {
        "add_note",
        "create_task",
        "create_event",
        "log_interaction",
        "attach_photos_to_property",
        "create_document_from_photos",
    }
)

#: Everything not listed above. Named explicitly so a NEW intent defaults to
#: asking rather than silently inheriting `execute` — the failure mode this
#: whole module exists to remove.
DEFAULT_LEVEL = AutonomyLevel.SUGGEST


def default_level(action_kind: str) -> AutonomyLevel:
    """The level for an action when the tenant has not configured one."""
    return AutonomyLevel.EXECUTE if action_kind in _EXECUTE_BY_DEFAULT else DEFAULT_LEVEL


def level_for(tenant_id: UUID, action_kind: str) -> AutonomyLevel:
    """The tenant's level for one action, falling back to the risk default.

    A lookup failure falls back too, rather than raising: the alternative is an
    agent turn that dies because a settings table was briefly unreachable, and
    the fallback is the conservative value for anything that matters.
    """
    try:
        rows = (
            get_supabase_client()
            .table("agent_action_policies")
            .select("level")
            .eq("tenant_id", str(tenant_id))
            .eq("action_kind", action_kind)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001 — see docstring
        logger.warning("agent_policy_lookup_failed", action_kind=action_kind, error=str(exc)[:200])
        return default_level(action_kind)

    if not rows:
        return default_level(action_kind)
    try:
        return AutonomyLevel(rows[0]["level"])
    except ValueError:
        logger.warning("agent_policy_unknown_level", action_kind=action_kind, level=rows[0].get("level"))
        return default_level(action_kind)
