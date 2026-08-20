"""Note ↔ record links: `note_targets` reads/writes plus name resolution.

A note carries ids, never names. The list endpoint used to hand the client
`("contacts", <uuid>)` and the UI could only print the word "Contacto" -- the
link existed in the database and was invisible on screen.

Resolution happens here, in batch: one query per target kind for the whole
page of notes, so twenty notes cost at most six queries instead of twenty
round trips from the client.

Two link generations coexist on purpose. `note_targets` (20240601000056) is
the real, cascading one; the legacy `notes.target_table`/`target_row_id` pair
is still written by the agent (`agent/tools/executors.py:461`), so reads union
both and writes keep the pair in sync with the first target.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

NOTE_TARGETS_TABLE = "note_targets"

# kind -> the typed FK column that holds the id for that kind.
KIND_COLUMN: dict[str, str] = {
    "PROPERTY": "property_id",
    "CONTACT": "contact_id",
    "OPPORTUNITY": "opportunity_id",
    "EVENT": "event_id",
    "PROJECT": "project_id",
    "PLACE": "place_id",
}

# kind -> physical table, which is also what the legacy pair stores. `contacts`
# and not the `people` view: the view cannot be a FK target and the writers
# have always used the base table.
KIND_TABLE: dict[str, str] = {
    "PROPERTY": "properties",
    "CONTACT": "contacts",
    "OPPORTUNITY": "opportunities",
    "EVENT": "events",
    "PROJECT": "projects",
    "PLACE": "places",
}

# Inverse, tolerating the `people` alias older callers may pass.
TABLE_KIND: dict[str, str] = {table: kind for kind, table in KIND_TABLE.items()}
TABLE_KIND["people"] = "CONTACT"

# Column holding the human name, for the kinds where one column is enough.
_LABEL_COLUMN: dict[str, str] = {
    "PROPERTY": "title",
    "CONTACT": "full_name",
    "EVENT": "title",
    "PROJECT": "name",
    "PLACE": "name",
}

_FALLBACK_LABEL: dict[str, str] = {
    "PROPERTY": "Propiedad",
    "CONTACT": "Contacto",
    "OPPORTUNITY": "Oportunidad",
    "EVENT": "Evento",
    "PROJECT": "Proyecto",
    "PLACE": "Lugar",
}

TargetKey = tuple[str, str]


def kind_for_table(table: str | None) -> str | None:
    """Kind for a legacy `target_table` value, or None when it is not linkable."""
    if not table:
        return None
    return TABLE_KIND.get(table)


def fallback_label(kind: str) -> str:
    return _FALLBACK_LABEL.get(kind, kind)


def _fetch_named(client: Any, kind: str, tenant_id: UUID, ids: list[str]) -> dict[str, str]:
    """Label per id for a kind whose name lives in a single column."""
    column = _LABEL_COLUMN[kind]
    rows = (
        client.table(KIND_TABLE[kind])
        .select(f"id, {column}")
        .eq("tenant_id", str(tenant_id))
        .in_("id", ids)
        .execute()
        .data
        or []
    )
    return {row["id"]: (row.get(column) or fallback_label(kind)) for row in rows}


def _fetch_opportunities(client: Any, tenant_id: UUID, ids: list[str]) -> tuple[dict[str, str], set[str], set[str]]:
    """Opportunity rows plus the property/contact ids their labels need.

    `opportunities` has no name of its own, so the label is borrowed from the
    property or the person the deal is about. Those ids are returned rather
    than resolved here so they can join the property/contact batch instead of
    firing two more queries.
    """
    rows = (
        client.table("opportunities")
        .select("id, property_id, person_id, pipeline_stage")
        .eq("tenant_id", str(tenant_id))
        .in_("id", ids)
        .execute()
        .data
        or []
    )
    by_id = {row["id"]: row for row in rows}
    property_ids = {row["property_id"] for row in rows if row.get("property_id")}
    contact_ids = {row["person_id"] for row in rows if row.get("person_id")}
    return by_id, property_ids, contact_ids  # type: ignore[return-value]


def resolve_labels(tenant_id: UUID, keys: set[TargetKey]) -> dict[TargetKey, str]:
    """Human label for every `(kind, row_id)`, in one query per kind.

    Unresolvable keys are simply absent: a row deleted outside a cascade (the
    legacy pair has no FK) must degrade to a generic chip, not a 500.
    """
    if not keys:
        return {}
    client = get_supabase_client()

    by_kind: dict[str, list[str]] = {}
    for kind, row_id in keys:
        by_kind.setdefault(kind, []).append(row_id)

    # Opportunities first: they contribute extra property/contact ids, and
    # folding those into the batches below keeps the query count flat.
    opportunities: dict[str, dict] = {}
    if "OPPORTUNITY" in by_kind:
        opportunities, extra_properties, extra_contacts = _fetch_opportunities(
            client, tenant_id, by_kind["OPPORTUNITY"]
        )
        if extra_properties:
            by_kind.setdefault("PROPERTY", []).extend(extra_properties)
        if extra_contacts:
            by_kind.setdefault("CONTACT", []).extend(extra_contacts)

    names: dict[str, dict[str, str]] = {}
    for kind, ids in by_kind.items():
        if kind not in _LABEL_COLUMN:
            continue
        names[kind] = _fetch_named(client, kind, tenant_id, list(dict.fromkeys(ids)))

    labels: dict[TargetKey, str] = {}
    for kind, row_id in keys:
        if kind == "OPPORTUNITY":
            row = opportunities.get(row_id)
            if not row:
                continue
            borrowed = names.get("PROPERTY", {}).get(row.get("property_id") or "") or names.get("CONTACT", {}).get(
                row.get("person_id") or ""
            )
            labels[(kind, row_id)] = borrowed or f"Oportunidad · {row.get('pipeline_stage') or ''}".strip(" ·")
            continue
        label = names.get(kind, {}).get(row_id)
        if label:
            labels[(kind, row_id)] = label
    return labels


def list_target_rows(tenant_id: UUID, note_ids: list[str]) -> list[dict]:
    """Raw `note_targets` rows for a page of notes, in one query."""
    if not note_ids:
        return []
    client = get_supabase_client()
    return (
        client.table(NOTE_TARGETS_TABLE)
        .select("*")
        .eq("tenant_id", str(tenant_id))
        .in_("note_id", note_ids)
        .order("created_at")
        .execute()
        .data
        or []
    )


def row_to_target(row: dict) -> dict | None:
    """`note_targets` row -> the flat `{id, kind, row_id}` the API exposes."""
    kind = row.get("target_kind")
    if kind not in KIND_COLUMN:
        return None
    row_id = row.get(KIND_COLUMN[kind])
    if not row_id:
        return None
    return {"id": row["id"], "note_id": row["note_id"], "kind": kind, "row_id": row_id}


def attach_labels(targets: list[dict], tenant_id: UUID) -> list[dict]:
    """Add `label` + `target_table` to flat targets, resolving names in batch."""
    labels = resolve_labels(tenant_id, {(t["kind"], t["row_id"]) for t in targets})
    for target in targets:
        key = (target["kind"], target["row_id"])
        target["label"] = labels.get(key, fallback_label(target["kind"]))
        # `resolved` tells the UI whether the name is real or a placeholder, so
        # it can grey out a chip whose record no longer exists.
        target["resolved"] = key in labels
        target["target_table"] = KIND_TABLE[target["kind"]]
    return targets


def note_ids_for_target(tenant_id: UUID, kind: str, row_id: UUID) -> list[str]:
    """Ids of notes linked to one record through `note_targets`."""
    client = get_supabase_client()
    rows = (
        client.table(NOTE_TARGETS_TABLE)
        .select("note_id")
        .eq("tenant_id", str(tenant_id))
        .eq("target_kind", kind)
        .eq(KIND_COLUMN[kind], str(row_id))
        .execute()
        .data
        or []
    )
    return [row["note_id"] for row in rows]


def insert_targets(
    tenant_id: UUID,
    note_id: UUID,
    created_by: UUID | None,
    targets: list[tuple[str, UUID]],
) -> list[dict]:
    """Link a note to records. Duplicates are dropped, not rejected."""
    if not targets:
        return []
    client = get_supabase_client()

    # Uniqueness is enforced by six PARTIAL indexes, which PostgREST's upsert
    # cannot name as a conflict target (it only knows the primary key). So the
    # duplicates are filtered here and the insert stays a plain insert; the
    # indexes remain the backstop against a concurrent double-add.
    existing = list_target_rows(tenant_id, [str(note_id)])
    already = {
        (row["target_kind"], row.get(KIND_COLUMN[row["target_kind"]]))
        for row in existing
        if row.get("target_kind") in KIND_COLUMN
    }

    rows = []
    seen: set[tuple[str, str]] = set()
    for kind, row_id in targets:
        key = (kind, str(row_id))
        if kind not in KIND_COLUMN or key in already or key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "tenant_id": str(tenant_id),
                "note_id": str(note_id),
                "target_kind": kind,
                KIND_COLUMN[kind]: str(row_id),
                "created_by": str(created_by) if created_by else None,
            }
        )
    if not rows:
        return []
    inserted = client.table(NOTE_TARGETS_TABLE).insert(rows).execute().data or []
    return [t for t in (row_to_target(row) for row in inserted) if t]


def delete_target(tenant_id: UUID, note_id: UUID, target_id: UUID) -> bool:
    client = get_supabase_client()
    deleted = (
        client.table(NOTE_TARGETS_TABLE)
        .delete()
        .eq("id", str(target_id))
        .eq("note_id", str(note_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
    )
    return bool(deleted)
