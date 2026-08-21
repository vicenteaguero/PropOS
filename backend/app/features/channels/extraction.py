"""Turn what a client wrote into something the CRM can act on.

This is the whole thesis of the product, and until now it did not happen. The
B2C assistant read an inbound message, generated a reply and threw the content
away: its system prompt asks the model to "capture budget, comuna, bedrooms"
and nothing anywhere parsed the answer. Registering stayed a separate chore
somebody had to remember, which is why every real-estate CRM ends up stale.

Two rules make this safe enough to run on a stranger's words:

* **Always a proposal, never a write.** The tenant's autonomy policy governs
  what the BROKER's own instructions may do unattended. A message from outside
  the company is not an instruction — anyone who knows the number can send one,
  and "agenda una visita mañana" from a stranger must not become a calendar
  entry because an LLM found an intent in it.
* **Always with the quote.** A proposal a reviewer cannot trace back to what
  the client actually said is not reviewable, and the reviewer is the only
  thing standing between the model and the database.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.features.agent.classifier import classify
from app.features.agent.context import load_snapshot
from app.features.agent.dispatcher import dispatch
from app.features.agent.policies import AutonomyLevel
from app.features.agent.resolver import resolve

logger = get_logger("INBOUND_EXTRACT")

#: Intents worth extracting from a client's message. A client can tell you
#: something worth writing down, someone to call and a time to meet — they
#: cannot tell you to create a property or move money, and an LLM that thinks
#: otherwise should not be believed.
_EXTRACTABLE = frozenset({"log_interaction", "create_task", "create_event", "add_note"})


async def extract_from_inbound(
    *,
    tenant_id: UUID | str,
    conversation: dict[str, Any],
    message_id: str,
    text: str,
    proposed_by_user: UUID | str,
) -> dict[str, Any] | None:
    """Read one inbound message and propose what it implies. Never writes.

    Returns the created proposal, or None when there was nothing to propose —
    which is the common case and must be silent, not an error.
    """
    tenant = UUID(str(tenant_id))
    contact_id = conversation.get("contact_id")
    if not contact_id:
        # Nobody to attribute it to. An unidentified thread gets identified
        # first; proposing against a phone number would create rows nobody
        # can find later.
        return None

    try:
        action = await classify(text)
    except Exception as exc:  # noqa: BLE001 — extraction is best-effort
        logger.warning("inbound_classify_failed", error=str(exc)[:200])
        return None

    intent = action.intent or ""
    if intent not in _EXTRACTABLE:
        return None

    fields = dict(action.fields or {})
    # The message came from this person; the classifier cannot know that.
    fields.setdefault("person_id", str(contact_id))

    resolved = resolve(fields, load_snapshot(tenant), intent=intent)

    # Through the real dispatcher rather than a second copy of payload
    # assembly: defaults, required-field checks and ambiguity handling are all
    # already there and already tested. The only thing this caller changes is
    # that the outcome can never be a write.
    outcome = dispatch(
        intent,
        resolved,
        tenant_id=tenant,
        user_id=UUID(str(proposed_by_user)) if proposed_by_user else uuid4(),
        session_id=uuid4(),
        force_level=AutonomyLevel.SUGGEST,
        message_id=message_id,
        evidence={
            "quote": text[:500],
            "source": conversation.get("source") or "whatsapp",
            "conversation_id": conversation.get("id"),
            "client_message_id": message_id,
        },
    )
    if outcome.get("kind") != "proposal":
        # "clarify" and "out_of_scope" are the common answers, and both mean
        # there is nothing worth asking a human about.
        return None
    result = outcome

    logger.info(
        "inbound_extracted",
        event_type="write",
        intent=intent,
        conversation_id=conversation.get("id"),
        proposal_id=result.get("proposal_id"),
    )
    return result
