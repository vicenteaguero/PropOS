from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.notes import attachments as note_attachments
from app.features.notes import targets as note_targets

NOTES_TABLE = "notes"

# Identifier reported for a link that only exists as the legacy
# `target_table`/`target_row_id` pair, so one unlink route covers both shapes.
LEGACY_TARGET_ID = "legacy"


class NoteService:
    @staticmethod
    def _hydrate(rows: list[dict], tenant_id: UUID) -> list[dict]:
        """Attach resolved targets and signed attachments to a page of notes.

        Batched on purpose: the client gets names and thumbnails without a
        single follow-up request, and the cost is a fixed handful of queries
        rather than one per note.
        """
        if not rows:
            return []
        note_ids = [row["id"] for row in rows]

        flat: list[dict] = []
        for target_row in note_targets.list_target_rows(tenant_id, note_ids):
            target = note_targets.row_to_target(target_row)
            if target:
                flat.append(target)
        linked = {t["note_id"] for t in flat}

        # A note the agent wrote (or one whose backfill found no live record)
        # still carries only the old pair; surface it as a target too so the
        # view never silently drops a link.
        for row in rows:
            if row["id"] in linked or not row.get("target_row_id"):
                continue
            kind = note_targets.kind_for_table(row.get("target_table"))
            if not kind:
                continue
            flat.append(
                {
                    "id": LEGACY_TARGET_ID,
                    "note_id": row["id"],
                    "kind": kind,
                    "row_id": row["target_row_id"],
                }
            )

        note_targets.attach_labels(flat, tenant_id)
        by_note: dict[str, list[dict]] = {}
        for target in flat:
            by_note.setdefault(target["note_id"], []).append(target)

        media = note_attachments.list_for_notes(tenant_id, note_ids)
        for row in rows:
            row["targets"] = by_note.get(row["id"], [])
            row["attachments"] = media.get(row["id"], [])
        return rows

    @staticmethod
    async def list_notes(
        tenant_id: UUID,
        target_table: str | None = None,
        target_row_id: UUID | None = None,
        limit: int = 100,
    ) -> list[dict]:
        client = get_supabase_client()

        def base():
            return (
                client.table(NOTES_TABLE)
                .select("*")
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .limit(limit)
            )

        if target_table and target_row_id:
            # Two reads merged in Python rather than one PostgREST `or_` with a
            # nested `and(...)`: the id list is unbounded and interpolating it
            # into a filter string is how quoting bugs get in.
            rows = base().eq("target_table", target_table).eq("target_row_id", str(target_row_id)).execute().data or []
            kind = note_targets.kind_for_table(target_table)
            if kind:
                ids = note_targets.note_ids_for_target(tenant_id, kind, target_row_id)
                if ids:
                    rows += base().in_("id", ids).execute().data or []
            seen: set[str] = set()
            merged = [r for r in rows if not (r["id"] in seen or seen.add(r["id"]))]
            merged.sort(key=lambda r: r["created_at"], reverse=True)
            rows = merged[:limit]
        elif target_table:
            rows = base().eq("target_table", target_table).execute().data or []
        else:
            rows = base().execute().data or []

        return NoteService._hydrate(rows, tenant_id)

    @staticmethod
    async def get_note(note_id: UUID, tenant_id: UUID) -> dict | None:
        client = get_supabase_client()
        rows = (
            client.table(NOTES_TABLE)
            .select("*")
            .eq("id", str(note_id))
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        return NoteService._hydrate(rows, tenant_id)[0]

    @staticmethod
    async def create_note(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude={"targets"})
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)

        links = [(t.kind, t.row_id) for t in getattr(payload, "targets", [])]
        # The legacy pair mirrors the first link so readers that still only know
        # about it (the agent, older timeline queries) keep working.
        if links and not data.get("target_row_id"):
            kind, row_id = links[0]
            data["target_table"] = note_targets.KIND_TABLE[kind]
            data["target_row_id"] = str(row_id)
        elif data.get("target_row_id") is not None:
            data["target_row_id"] = str(data["target_row_id"])

        row = client.table(NOTES_TABLE).insert(data).execute().data[0]
        if links:
            note_targets.insert_targets(tenant_id, UUID(row["id"]), created_by, links)
        return NoteService._hydrate([row], tenant_id)[0]

    @staticmethod
    async def update_note(note_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        row = (
            client.table(NOTES_TABLE)
            .update(data)
            .eq("id", str(note_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data[0]
        )
        return NoteService._hydrate([row], tenant_id)[0]

    @staticmethod
    async def delete_note(note_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(NOTES_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(note_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()

    @staticmethod
    async def add_targets(note_id: UUID, tenant_id: UUID, created_by: UUID, links: list) -> list[dict]:
        pairs = [(t.kind, t.row_id) for t in links]
        created = note_targets.insert_targets(tenant_id, note_id, created_by, pairs)
        return note_targets.attach_labels(created, tenant_id)

    @staticmethod
    async def remove_target(note_id: UUID, tenant_id: UUID, target_id: str) -> bool:
        if target_id == LEGACY_TARGET_ID:
            # Nothing to delete -- the link IS two columns on the note.
            client = get_supabase_client()
            updated = (
                client.table(NOTES_TABLE)
                .update({"target_table": None, "target_row_id": None})
                .eq("id", str(note_id))
                .eq("tenant_id", str(tenant_id))
                .execute()
                .data
            )
            return bool(updated)
        return note_targets.delete_target(tenant_id, note_id, UUID(target_id))
