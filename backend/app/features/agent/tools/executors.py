"""Agent proposal writers + accept-side dispatchers.

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

logger = get_logger("AGENT_TOOLS")

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
        "agent_session_id": str(session_id),
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


def _accept_create_person(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    if "kind" in payload:
        payload["type"] = payload.pop("kind")
    row = client.table("contacts").insert(payload).execute().data[0]
    return ("contacts", UUID(row["id"]))


def _accept_update_person(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    row_id = payload.get("id")
    if not row_id:
        raise ValueError("missing contact id for update")
    # full_name is the match key, not necessarily a change; id locates the row.
    updates = {k: v for k, v in payload.items() if k not in ("summary_es", "id", "full_name")}
    if "kind" in updates:
        updates["type"] = updates.pop("kind")
    if not updates:
        raise ValueError("no fields to update")
    client.table("contacts").update(updates).eq("id", str(row_id)).eq("tenant_id", str(tenant_id)).execute()
    return ("contacts", UUID(row_id))


def _accept_log_interaction(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    participants = payload.pop("participant_person_ids", []) or []
    property_id = payload.pop("property_id", None)
    project_id = payload.pop("project_id", None)
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
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


def _create_reminder_row(client, *, tenant_id, user_id, target_table, target_row_id, remind_at, message):
    client.table("reminders").insert(
        {
            "tenant_id": str(tenant_id),
            "target_table": target_table,
            "target_row_id": str(target_row_id),
            "user_id": str(user_id),
            "remind_at": remind_at,
            "message": message,
            "source": "agent",
            "created_by": str(user_id),
        }
    ).execute()


def _accept_create_task(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    remind_at = payload.get("remind_at")
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "remind_at")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
    row = client.table("tasks").insert(payload).execute().data[0]
    if remind_at:
        _create_reminder_row(
            client,
            tenant_id=tenant_id,
            user_id=user_id,
            target_table="tasks",
            target_row_id=row["id"],
            remind_at=remind_at,
            message=payload.get("title"),
        )
    return ("tasks", UUID(row["id"]))


def _accept_create_event(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    remind_at = payload.get("remind_at")
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "remind_at")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
    row = client.table("events").insert(payload).execute().data[0]
    if remind_at:
        _create_reminder_row(
            client,
            tenant_id=tenant_id,
            user_id=user_id,
            target_table="events",
            target_row_id=row["id"],
            remind_at=remind_at,
            message=payload.get("title"),
        )
    return ("events", UUID(row["id"]))


def _accept_log_transaction(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    # The classifier/registry emit money under `amount` (whole pesos); the DB
    # column is `amount_cents` (BIGINT). Convert before stripping `amount`,
    # otherwise every agent-logged transaction fails on accept.
    amount = payload.get("amount")
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "amount")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
    if not payload.get("occurred_at"):
        payload["occurred_at"] = datetime.now(UTC).isoformat()
    if "amount_cents" not in payload:
        if amount is None:
            raise ValueError("missing amount in resolved payload")
        payload["amount_cents"] = int(round(float(amount) * 100))
    row = client.table("transactions").insert(payload).execute().data[0]
    return ("transactions", UUID(row["id"]))


def _accept_create_campaign(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es", "budget")}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
    row = client.table("campaigns").insert(payload).execute().data[0]
    return ("campaigns", UUID(row["id"]))


def _accept_create_organization(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    row = client.table("organizations").insert(payload).execute().data[0]
    return ("organizations", UUID(row["id"]))


def _accept_create_property(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k != "summary_es"}

    row: dict[str, Any] = {
        "tenant_id": str(tenant_id),
        "created_by": str(user_id),
        "is_draft": bool(payload.get("is_draft", False)),
    }
    # Direct text/enum columns.
    for k in ("title", "address", "status", "description"):
        if payload.get(k) is not None:
            row[k] = payload[k]
    # Numeric columns — pass-2 LLM may return strings, so coerce defensively.
    for src, col in (
        ("bedrooms", "bedrooms"),
        ("bathrooms", "bathrooms"),
        ("year_built", "year_built"),
        ("area_m2", "area_sqm"),
    ):
        v = payload.get(src)
        if v is not None:
            try:
                row[col] = int(round(float(v)))
            except (TypeError, ValueError):
                pass
    # Pesos → cents (list_price_cents is int8).
    if payload.get("price_clp") is not None:
        try:
            row["list_price_cents"] = int(round(float(payload["price_clp"]))) * 100
            row.setdefault("currency", "CLP")
        except (TypeError, ValueError):
            pass
    # Captured fields without a dedicated column → metadata JSONB (nothing dropped).
    meta = {
        k: payload[k]
        for k in (
            "comuna",
            "parking_count",
            "has_storage",
            "hoa_clp",
            "orientation",
            "property_type",
            "owner_name",
        )
        if payload.get(k) is not None
    }
    if meta:
        row["metadata"] = meta
    inserted = client.table("properties").insert(row).execute().data[0]
    return ("properties", UUID(inserted["id"]))


def _materialize_media(
    media_message_ids: list[str],
    *,
    tenant_id: UUID,
    user_id: UUID,
) -> list[UUID]:
    """For each agent_messages id, lift its media into media_files (one row
    per file) and mark the message consumed. Returns the new media_files ids."""
    if not media_message_ids:
        return []
    client = get_supabase_client()
    msgs = (
        client.table("agent_messages").select("id, media_url, media_mime").in_("id", media_message_ids).execute().data
        or []
    )
    file_ids: list[UUID] = []
    consumed: list[str] = []
    for m in msgs:
        if not m.get("media_url"):
            continue
        mime = m.get("media_mime") or "application/octet-stream"
        # `media_files.type` and `.source` are CHECK-constrained to
        # ('photo','audio') and ('camera','gallery','recorder'). Writing the raw
        # mime type and 'whatsapp' made every insert here fail. The finer
        # classification lives in `kind`; the WhatsApp provenance stays on the
        # originating `agent_messages` row (`media_kapso_id`).
        if mime.startswith("image/"):
            file_type, file_source, file_kind = "photo", "gallery", "PHOTO"
        elif mime.startswith("audio/"):
            file_type, file_source, file_kind = "audio", "recorder", "AUDIO"
        else:
            logger.warning("media_type_unsupported", event_type="write", message_id=m["id"], mime=mime)
            continue
        file_row = (
            client.table("media_files")
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "url": m["media_url"],
                    "type": file_type,
                    "source": file_source,
                    "uploaded_by": str(user_id),
                    "kind": file_kind,
                }
            )
            .execute()
            .data[0]
        )
        file_ids.append(UUID(file_row["id"]))
        consumed.append(m["id"])
    if consumed:
        client.table("agent_messages").update({"media_status": "consumed"}).in_("id", consumed).execute()
    return file_ids


def _accept_attach_photos_to_property(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    property_id = payload.get("property_id")
    if not property_id:
        raise ValueError("missing property_id (no resolved property match)")
    media_message_ids = payload.get("media_message_ids") or []
    file_ids = _materialize_media(media_message_ids, tenant_id=tenant_id, user_id=user_id)
    rows = [
        {
            "tenant_id": str(tenant_id),
            "media_file_id": str(fid),
            "target_table": "properties",
            "target_row_id": str(property_id),
            "role": "PHOTO",
            "position": idx,
            "created_by": str(user_id),
        }
        for idx, fid in enumerate(file_ids)
    ]
    if rows:
        client.table("media_assets").insert(rows).execute()
    return ("media_assets", UUID(property_id))


def _accept_create_document_from_photos(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    media_message_ids = payload.get("media_message_ids") or []
    file_ids = _materialize_media(media_message_ids, tenant_id=tenant_id, user_id=user_id)
    doc_row = (
        client.table("documents")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "display_name": payload.get("title") or "Documento",
                "kind": "OTHER",
                "origin": "GENERATED",
                "created_by": str(user_id),
            }
        )
        .execute()
        .data[0]
    )
    rows = [
        {
            "tenant_id": str(tenant_id),
            "media_file_id": str(fid),
            "target_table": "documents",
            "target_row_id": doc_row["id"],
            "role": "PAGE",
            "position": idx,
            "created_by": str(user_id),
        }
        for idx, fid in enumerate(file_ids)
    ]
    if rows:
        client.table("media_assets").insert(rows).execute()
    return ("documents", UUID(doc_row["id"]))


def _accept_add_note(payload, tenant_id, user_id, agent_session_id):
    client = get_supabase_client()
    payload = {k: v for k, v in payload.items() if k not in ("summary_es",)}
    payload["tenant_id"] = str(tenant_id)
    payload["created_by"] = str(user_id)
    payload["source"] = "agent"
    row = client.table("notes").insert(payload).execute().data[0]
    return ("notes", UUID(row["id"]))


# Registry used both by /admin/pendientes (manual accept) and by the dispatcher
# auto-commit path. Map proposal_kind -> writer fn.
ACCEPTOR_BY_KIND: dict[str, Any] = {
    "propose_create_person": _accept_create_person,
    "propose_update_person": _accept_update_person,
    "propose_log_interaction": _accept_log_interaction,
    "propose_create_task": _accept_create_task,
    "propose_create_event": _accept_create_event,
    "propose_log_transaction": _accept_log_transaction,
    "propose_create_campaign": _accept_create_campaign,
    "propose_create_organization": _accept_create_organization,
    "propose_create_property": _accept_create_property,
    "propose_add_note": _accept_add_note,
    "propose_attach_photos_to_property": _accept_attach_photos_to_property,
    "propose_create_document_from_photos": _accept_create_document_from_photos,
}


def register_all_dispatchers() -> None:
    """Called from main.py / app startup to wire pending acceptance."""
    from app.features.pending.service import register_accept_dispatcher

    for kind, fn in ACCEPTOR_BY_KIND.items():
        register_accept_dispatcher(kind, fn)
