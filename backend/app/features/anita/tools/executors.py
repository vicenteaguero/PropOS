"""Tool executors invoked by the Anita chat loop.

- find_*: read live data, return candidates
- propose_*: write to pending_proposals (NEVER touch domain tables)
- clarify: no-op (the model uses it to defer to user)
- query_data: see query_data.py
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("ANITA_TOOLS")

PENDING_TABLE = "pending_proposals"


# ---------- Read tools ----------

def find_person(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    q = args.get("query", "").strip()
    limit = min(int(args.get("limit", 5)), 20)
    if not q:
        return {"candidates": []}
    client = get_supabase_client()
    rows = (
        client.table("contacts")
        .select("id,full_name,type,phone,email,rut")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .ilike("full_name", f"%{q}%")
        .limit(limit)
        .execute()
        .data
    )
    return {"candidates": rows, "count": len(rows)}


def find_property(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    q = args.get("query", "").strip()
    limit = min(int(args.get("limit", 5)), 20)
    client = get_supabase_client()
    builder = (
        client.table("properties")
        .select("id,title,status,address")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(limit)
    )
    if q:
        builder = builder.or_(f"title.ilike.%{q}%,address.ilike.%{q}%")
    if args.get("status"):
        builder = builder.eq("status", args["status"])
    return {"candidates": builder.execute().data}


def find_organization(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    q = args.get("query", "").strip()
    limit = min(int(args.get("limit", 5)), 20)
    client = get_supabase_client()
    builder = (
        client.table("organizations")
        .select("id,name,kind")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .ilike("name", f"%{q}%")
        .limit(limit)
    )
    if args.get("kind"):
        builder = builder.eq("kind", args["kind"])
    return {"candidates": builder.execute().data}


def find_project(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    q = args.get("query", "").strip()
    limit = min(int(args.get("limit", 5)), 20)
    client = get_supabase_client()
    rows = (
        client.table("projects")
        .select("id,name,kind,status")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .ilike("name", f"%{q}%")
        .limit(limit)
        .execute()
        .data
    )
    return {"candidates": rows}


def find_campaign(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    q = args.get("query", "").strip()
    limit = min(int(args.get("limit", 5)), 20)
    client = get_supabase_client()
    builder = (
        client.table("campaigns")
        .select("id,name,channel,status")
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .ilike("name", f"%{q}%")
        .limit(limit)
    )
    if args.get("channel"):
        builder = builder.eq("channel", args["channel"])
    return {"candidates": builder.execute().data}


def clarify(args: dict[str, Any], tenant_id: UUID) -> dict[str, Any]:
    # Pure UI signal; payload returned verbatim to the frontend.
    return {"clarify": True, "question": args.get("question"), "candidates": args.get("candidates")}


# ---------- Propose tools ----------

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


def propose_create_person(args, tenant_id, user_id, session_id):
    return _create_proposal(
        kind="propose_create_person",
        payload=args,
        target_table="contacts",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_log_interaction(args, tenant_id, user_id, session_id):
    return _create_proposal(
        kind="propose_log_interaction",
        payload=args,
        target_table="interactions",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_create_task(args, tenant_id, user_id, session_id):
    return _create_proposal(
        kind="propose_create_task",
        payload=args,
        target_table="tasks",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_log_transaction(args, tenant_id, user_id, session_id):
    # Convert pesos→cents
    resolved = dict(args)
    if "amount" in resolved:
        resolved["amount_cents"] = int(resolved.pop("amount")) * 100
    return _create_proposal(
        kind="propose_log_transaction",
        payload=args,
        resolved_payload=resolved,
        target_table="transactions",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_create_campaign(args, tenant_id, user_id, session_id):
    resolved = dict(args)
    if "budget" in resolved and resolved["budget"] is not None:
        resolved["budget_cents"] = int(resolved.pop("budget")) * 100
    return _create_proposal(
        kind="propose_create_campaign",
        payload=args,
        resolved_payload=resolved,
        target_table="campaigns",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_create_organization(args, tenant_id, user_id, session_id):
    return _create_proposal(
        kind="propose_create_organization",
        payload=args,
        target_table="organizations",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


def propose_add_note(args, tenant_id, user_id, session_id):
    return _create_proposal(
        kind="propose_add_note",
        payload=args,
        target_table="notes",
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )


# ---------- Dispatch table ----------

READ_DISPATCH = {
    "find_person": find_person,
    "find_property": find_property,
    "find_organization": find_organization,
    "find_project": find_project,
    "find_campaign": find_campaign,
    "clarify": clarify,
}

PROPOSE_DISPATCH = {
    "propose_create_person": propose_create_person,
    "propose_log_interaction": propose_log_interaction,
    "propose_create_task": propose_create_task,
    "propose_log_transaction": propose_log_transaction,
    "propose_create_campaign": propose_create_campaign,
    "propose_create_organization": propose_create_organization,
    "propose_add_note": propose_add_note,
}


def dispatch_tool(
    name: str,
    args: dict[str, Any],
    tenant_id: UUID,
    user_id: UUID,
    session_id: UUID,
) -> dict[str, Any]:
    if name in READ_DISPATCH:
        return READ_DISPATCH[name](args, tenant_id)
    if name == "query_data":
        from app.features.anita.tools.query_data import run_query

        return run_query(args, tenant_id)
    if name in PROPOSE_DISPATCH:
        return PROPOSE_DISPATCH[name](args, tenant_id, user_id, session_id)
    return {"error": f"unknown tool {name!r}"}


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
    register_accept_dispatcher("propose_add_note", _accept_add_note)
