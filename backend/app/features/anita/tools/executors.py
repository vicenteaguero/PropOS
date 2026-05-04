"""Anita proposal writers + accept-side dispatchers.

The v2 pipeline (``classifier`` → ``resolver`` → ``dispatcher``) calls
``_create_proposal`` directly. The pending-review feature (when a human
clicks "Accept") fans out to the per-kind ``_accept_*`` functions
registered via ``register_all_dispatchers``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("ANITA_TOOLS")

PENDING_TABLE = "pending_proposals"


# ---------- Propose: write to pending_proposals ----------


def _create_proposal(
    *,
    kind: str,
    payload: dict[str, Any],
    tenant_id: UUID,
    user_id: UUID,
    session_id: UUID,
    target_table: str | None = None,
    resolved_payload: dict[str, Any] | None = None,
    ambiguity: dict[str, Any] | None = None,
    confidence: float | None = None,
) -> dict[str, Any]:
    client = get_supabase_client()
    row = {
        "id": str(uuid4()),
        "tenant_id": str(tenant_id),
        "anita_session_id": str(session_id),
        "proposed_by_user": str(user_id),
        "kind": kind,
        "target_table": target_table,
        "payload": payload,
        "resolved_payload": resolved_payload or payload,
        "ambiguity": ambiguity,
        "status": "pending",
        "confidence": confidence,
    }
    response = client.table(PENDING_TABLE).insert(row).execute().data[0]
    logger.info(
        "proposal_created",
        event_type="write",
        kind=kind,
        proposal_id=response["id"],
    )
    return {
        "proposal_id": response["id"],
        "kind": kind,
        "summary_es": payload.get("summary_es"),
        "ambiguity_count": len((ambiguity or {}).get("candidates", [])) if ambiguity else 0,
    }


# ---------- Accept dispatchers (registered with pending/service.py) ----------


def _accept_create_person(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    if "kind" in payload:
        payload["type"] = payload.pop("kind")
    row = client.table("contacts").insert(payload).execute().data[0]
    return ("contacts", UUID(row["id"]))


def _accept_log_interaction(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    participants = payload.pop("participant_person_ids", []) or []
    property_id = payload.pop("property_id", None)
    project_id = payload.pop("project_id", None)
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "anita"
    if not payload.get("occurred_at"):
        payload["occurred_at"] = datetime.now(UTC).isoformat()
    row = client.table("interactions").insert(payload).execute().data[0]

    if participants:
        client.table("interaction_participants").insert(
            [
                {
                    "tenant_id": str(tenant_id),
                    "interaction_id": row["id"],
                    "person_id": str(p),
                }
                for p in participants
            ]
        ).execute()

    if property_id:
        client.table("interaction_targets").insert(
            {
                "tenant_id": str(tenant_id),
                "interaction_id": row["id"],
                "target_kind": "PROPERTY",
                "property_id": str(property_id),
            }
        ).execute()
    if project_id:
        client.table("interaction_targets").insert(
            {
                "tenant_id": str(tenant_id),
                "interaction_id": row["id"],
                "target_kind": "PROJECT",
                "project_id": str(project_id),
            }
        ).execute()

    return ("interactions", UUID(row["id"]))


def _accept_create_task(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "anita"
    row = client.table("tasks").insert(payload).execute().data[0]
    return ("tasks", UUID(row["id"]))


def _accept_log_transaction(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "amount")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "anita"
    if not payload.get("occurred_at"):
        payload["occurred_at"] = datetime.now(UTC).isoformat()
    if "amount_cents" not in payload:
        raise ValueError("missing amount_cents in resolved payload")
    row = client.table("transactions").insert(payload).execute().data[0]
    return ("transactions", UUID(row["id"]))


def _accept_create_campaign(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "budget")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "anita"
    row = client.table("campaigns").insert(payload).execute().data[0]
    return ("campaigns", UUID(row["id"]))


def _accept_create_organization(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    row = client.table("organizations").insert(payload).execute().data[0]
    return ("organizations", UUID(row["id"]))


def _accept_create_property(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    # public.properties only stores title/address/status/is_draft; the rest
    # of the registry's `detailed` fields are stashed on the proposal payload
    # for now and can be migrated to a `property_attributes` JSONB column.
    keep = {"tenant_id", "created_by", "title", "address", "status", "is_draft"}
    row = {k: v for k, v in payload.items() if k in keep}
    row.setdefault("is_draft", False)
    inserted = client.table("properties").insert(row).execute().data[0]
    return ("properties", UUID(inserted["id"]))


def _accept_add_note(payload, tenant_id, user_id, anita_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "anita"
    row = client.table("notes").insert(payload).execute().data[0]
    return ("notes", UUID(row["id"]))


def register_all_dispatchers() -> None:
    """Called from main.py / app startup to wire pending acceptance."""
    from app.features.pending.service import register_accept_dispatcher

    register_accept_dispatcher("propose_create_person", _accept_create_person)
    register_accept_dispatcher("propose_log_interaction", _accept_log_interaction)
    register_accept_dispatcher("propose_create_task", _accept_create_task)
    register_accept_dispatcher("propose_log_transaction", _accept_log_transaction)
    register_accept_dispatcher("propose_create_campaign", _accept_create_campaign)
    register_accept_dispatcher("propose_create_organization", _accept_create_organization)
    register_accept_dispatcher("propose_create_property", _accept_create_property)
    register_accept_dispatcher("propose_add_note", _accept_add_note)
