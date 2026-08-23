from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.db import run_blocking
from app.core.supabase.client import get_supabase_client
from app.features.notes.attachments import list_for_notes

TASKS_TABLE = "tasks"

logger = get_logger("TASKS")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


# `tasks.related` stores bare ids, so anything that wants to *show* a link has
# to resolve names. Doing it here rather than in the client is the same call the
# documents feature makes, and for the same reason: the entity list endpoints
# cap at 100 rows, so a client-side join silently fails on a real tenant.
_LABEL_CHUNK = 200


def _hydrate_related_labels(tenant_id: str, rows: list[dict]) -> None:
    """Attach `related_labels` to each task, in place."""
    property_ids: set[str] = set()
    contact_ids: set[str] = set()
    opportunity_ids: set[str] = set()
    for row in rows:
        related = row.get("related") or {}
        property_ids.update(related.get("properties") or [])
        contact_ids.update(related.get("people") or [])
        opportunity_ids.update(related.get("opportunities") or [])
    if not property_ids and not contact_ids and not opportunity_ids:
        for row in rows:
            row["related_labels"] = {"properties": [], "people": [], "opportunities": []}
        return

    client = get_supabase_client()

    def _names(table: str, ids: set[str], field: str) -> dict[str, str]:
        out: dict[str, str] = {}
        id_list = list(ids)
        for i in range(0, len(id_list), _LABEL_CHUNK):
            try:
                got = (
                    client.table(table).select(f"id, {field}").in_("id", id_list[i : i + _LABEL_CHUNK]).execute().data
                    or []
                )
            except Exception:  # noqa: BLE001 — a label is never worth a 500
                continue
            out.update({r["id"]: r.get(field) for r in got if r.get(field)})
        return out

    properties = _names("properties", property_ids, "title")
    contacts = _names("contacts", contact_ids, "full_name")
    # A deal has no title column of its own — it IS "this person, about this
    # property" — so its label is built from the two ids it carries. The two
    # name maps above are reused rather than re-queried; anything a deal points
    # at that is not already in them is fetched in one extra pair of reads.
    deals = _deal_labels(client, tenant_id, opportunity_ids, properties, contacts)

    for row in rows:
        related = row.get("related") or {}
        row["related_labels"] = {
            "properties": [{"id": pid, "label": properties.get(pid)} for pid in (related.get("properties") or [])],
            "people": [{"id": cid, "label": contacts.get(cid)} for cid in (related.get("people") or [])],
            "opportunities": [{"id": oid, "label": deals.get(oid)} for oid in (related.get("opportunities") or [])],
        }


def _deal_labels(
    client,
    tenant_id: str,
    opportunity_ids: set[str],
    properties: dict[str, str],
    contacts: dict[str, str],
) -> dict[str, str]:
    """`{opportunity_id: "Ana Pérez · Depto Macul"}`."""
    if not opportunity_ids:
        return {}
    rows: list[dict] = []
    ids = list(opportunity_ids)
    for i in range(0, len(ids), _LABEL_CHUNK):
        try:
            rows += (
                client.table("opportunities")
                .select("id, person_id, property_id, pipeline_stage")
                .eq("tenant_id", str(tenant_id))
                .in_("id", ids[i : i + _LABEL_CHUNK])
                .execute()
                .data
                or []
            )
        except Exception:  # noqa: BLE001 — a label is never worth a 500
            continue

    missing_people = {r["person_id"] for r in rows if r.get("person_id") and r["person_id"] not in contacts}
    missing_props = {r["property_id"] for r in rows if r.get("property_id") and r["property_id"] not in properties}
    names = {**contacts}
    titles = {**properties}
    if missing_people or missing_props:
        for table, want, sink, field in (
            ("contacts", missing_people, names, "full_name"),
            ("properties", missing_props, titles, "title"),
        ):
            if not want:
                continue
            try:
                got = (
                    client.table(table)
                    .select(f"id, {field}")
                    .eq("tenant_id", str(tenant_id))
                    .in_("id", list(want))
                    .execute()
                    .data
                    or []
                )
            except Exception:  # noqa: BLE001
                continue
            sink.update({r["id"]: r.get(field) for r in got if r.get(field)})

    out: dict[str, str] = {}
    for row in rows:
        parts = [names.get(row.get("person_id") or ""), titles.get(row.get("property_id") or "")]
        out[row["id"]] = " · ".join(p for p in parts if p) or "Negocio"
    return out


def _hydrate_attachments(tenant_id: UUID, rows: list[dict]) -> None:
    """Attach photos and voice memos, in place.

    One batched read for the whole page (see `list_for_notes`), not one per
    task. Best-effort: an attachment that fails to sign must not take the task
    list down with it.
    """
    if not rows:
        return
    try:
        grouped = list_for_notes(tenant_id, [r["id"] for r in rows], TASKS_TABLE)
    except Exception as exc:  # noqa: BLE001
        logger.warning("task attachment hydration failed", error=str(exc))
        grouped = {}
    for row in rows:
        row["attachments"] = grouped.get(row["id"], [])


class TaskService:
    @staticmethod
    async def list_tasks(
        tenant_id: UUID,
        kind: str | None = None,
        status: str | None = None,
        owner_user: UUID | None = None,
        only_open: bool = False,
        limit: int = 200,
    ) -> list[dict]:
        # Off the event loop: the Supabase client is synchronous, so an
        # inline round trip holds the whole worker for its duration.
        def _read() -> list[dict]:
            client = get_supabase_client()
            builder = (
                client.table(TASKS_TABLE)
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .order("priority", desc=True)
                .order("due_at", desc=False)
                .limit(limit)
            )
            if kind:
                builder = builder.eq("kind", kind)
            if status:
                builder = builder.eq("status", status)
            if owner_user is not None:
                builder = builder.eq("owner_user", str(owner_user))
            if only_open:
                builder = builder.in_("status", ["OPEN", "IN_PROGRESS", "BLOCKED"])
            rows = builder.execute().data or []
            _hydrate_related_labels(str(tenant_id), rows)
            _hydrate_attachments(tenant_id, rows)
            return rows

        return await run_blocking(_read)

    @staticmethod
    async def get_task(task_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(TASKS_TABLE)
            .select("*")
            .eq("id", str(task_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_task(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        for k in ("kind", "status"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        data = _serialize(data)
        response = client.table(TASKS_TABLE).insert(data).execute()
        logger.info("created", event_type="write", task_id=response.data[0]["id"])
        return response.data[0]

    @staticmethod
    async def update_task(task_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        for k in ("kind", "status"):
            if data.get(k) and hasattr(data[k], "value"):
                data[k] = data[k].value
        # Auto-set completed_at when transitioning to DONE
        if data.get("status") == "DONE" and "completed_at" not in data:
            data["completed_at"] = datetime.now(UTC).isoformat()
        data = _serialize(data)
        response = (
            client.table(TASKS_TABLE).update(data).eq("id", str(task_id)).eq("tenant_id", str(tenant_id)).execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_task(task_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TASKS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(task_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
