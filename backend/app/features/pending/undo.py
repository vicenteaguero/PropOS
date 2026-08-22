"""Undoing an accepted proposal.

The owner asked for a real undo: accepting a proposal should be reversible, not
just linkable-to. That is a destructive operation on live CRM data, so the
whole design is about the guard rather than the delete.

Two shapes, decided by what the accept actually did:

- It CREATED a row (a task, a contact, an event, …) → the row goes away.
  Soft-deleted where the table has `deleted_at`, so nothing is truly lost.
- It MODIFIED a row that already existed (`propose_update_person` edits a
  contact) → deleting it would destroy a real person. The audit log holds the
  `before` image written by that accept, so undoing an update is restoring it.
  This is exactly what the audit log is for.

And the guard that makes the whole thing safe: if there is ANY audit row for
that record newer than the agent's own, a human has edited it since, and undo
refuses. Without that, "deshacer" quietly overwrites the broker's own work with
a snapshot from before they did it.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("PENDING_UNDO")

#: Tables whose rows this may remove, and how. `soft` means the table carries
#: `deleted_at`; `hard` means it does not. A table absent from here cannot be
#: undone at all — silence is refusal, not permission.
_REMOVABLE: dict[str, str] = {
    "contacts": "soft",
    "tasks": "soft",
    "events": "soft",
    "interactions": "soft",
    "transactions": "soft",
    "notes": "soft",
    "documents": "soft",
    "properties": "soft",
    "organizations": "soft",
    "campaigns": "soft",
}

#: Proposals that EDIT an existing row rather than create one.
_UPDATE_KINDS = {"propose_update_person"}

#: Columns never restored from an audit snapshot: they describe the row's place
#: in the database, not its content, and writing them back can move it.
_IMMUTABLE = {"id", "tenant_id", "created_at", "created_by"}


class UndoError(ValueError):
    """Undo is not available for this proposal, and why."""


def _newer_human_edit(tenant_id: UUID, table: str, row_id: str, since: str | None) -> bool:
    """Has anyone touched this record after the agent wrote it?"""
    if not since:
        # No timestamp to compare against means we cannot prove the record is
        # untouched, and undo has to prove it.
        return True
    rows = (
        get_supabase_client()
        .table("audit_log")
        .select("id")
        .eq("tenant_id", str(tenant_id))
        .eq("table_name", table)
        .eq("row_id", row_id)
        .gt("changed_at", since)
        .limit(1)
        .execute()
        .data
        or []
    )
    return bool(rows)


def _agent_before_image(tenant_id: UUID, table: str, row_id: str) -> dict[str, Any] | None:
    """The row as it stood immediately before the agent's UPDATE."""
    rows = (
        get_supabase_client()
        .table("audit_log")
        .select("before,changed_at")
        .eq("tenant_id", str(tenant_id))
        .eq("table_name", table)
        .eq("row_id", row_id)
        .eq("op", "UPDATE")
        .eq("source", "agent")
        .order("changed_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0].get("before") if rows else None


def undo_accepted(proposal: dict[str, Any], tenant_id: UUID) -> str:
    """Reverse what accepting this proposal did. Returns a human description."""
    table = proposal.get("target_table")
    row_id = proposal.get("created_row_id")
    kind = proposal.get("kind")

    if not table or not row_id:
        raise UndoError("Esta propuesta no creó ningún registro.")

    if kind == "propose_attach_photos_to_property":
        # `created_row_id` holds the PROPERTY id, not the media rows the accept
        # actually inserted (see _accept_attach_photos_to_property), so there is
        # nothing here to identify what to remove.
        raise UndoError("Las fotos se quitan desde la propiedad.")

    client = get_supabase_client()
    reviewed_at = proposal.get("reviewed_at")

    if _newer_human_edit(tenant_id, table, str(row_id), reviewed_at):
        raise UndoError("Ya editaste este registro; revísalo en su ficha.")

    if kind in _UPDATE_KINDS:
        before = _agent_before_image(tenant_id, table, str(row_id))
        if not before:
            raise UndoError("No hay una versión anterior guardada de este registro.")
        restore = {k: v for k, v in before.items() if k not in _IMMUTABLE}
        client.table(table).update(restore).eq("id", str(row_id)).eq("tenant_id", str(tenant_id)).execute()
        return "Se restauraron los datos anteriores."

    mode = _REMOVABLE.get(table)
    if mode is None:
        raise UndoError(f"No se puede deshacer un registro de '{table}'.")

    if mode == "soft":
        from datetime import UTC, datetime

        client.table(table).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(row_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
    else:
        client.table(table).delete().eq("id", str(row_id)).eq("tenant_id", str(tenant_id)).execute()

    logger.info("proposal_undone", extra={"table": table, "row_id": str(row_id)})
    return "Se eliminó el registro que se había creado."
