"""Entity search behind every "link this to a record" picker.

One endpoint instead of one per feature. The notes picker needs six record
types; before this, only properties and contacts were reachable, because those
were the two list endpoints that happened to accept a `q`. Opportunities in
particular could never be searched at all: the table has no title column, its
label is derived from the person and the property it joins, so a text filter has
to resolve those first.

Every query is tenant-scoped and skips soft-deleted rows.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.search.schemas import EntityHit, EntityKind

# One page of picker results. Deliberately small: a picker is a keyboard-driven
# funnel, not a browsable list, and a long menu is slower to use than typing one
# more letter.
DEFAULT_LIMIT = 20


def _rows(table: str, tenant_id: UUID, select: str, limit: int) -> Any:
    return (
        get_supabase_client()
        .table(table)
        .select(select)
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(limit)
    )


def _search_properties(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    builder = _rows("properties", tenant_id, "id,title,address", limit).order("created_at", desc=True)
    if q:
        builder = builder.or_(f"title.ilike.%{q}%,address.ilike.%{q}%")
    return [
        EntityHit(kind=EntityKind.PROPERTY, id=r["id"], label=r.get("title") or "Sin título", sub=r.get("address"))
        for r in builder.execute().data
    ]


def _search_contacts(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    builder = _rows("contacts", tenant_id, "id,full_name,email,phone", limit).order("created_at", desc=True)
    if q:
        builder = builder.or_(f"full_name.ilike.%{q}%,email.ilike.%{q}%,phone.ilike.%{q}%")
    return [
        EntityHit(
            kind=EntityKind.CONTACT,
            id=r["id"],
            label=r.get("full_name") or "Sin nombre",
            sub=r.get("email") or r.get("phone"),
        )
        for r in builder.execute().data
    ]


def _search_events(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    builder = _rows("events", tenant_id, "id,title,starts_at", limit).order("starts_at", desc=True)
    if q:
        builder = builder.ilike("title", f"%{q}%")
    return [
        EntityHit(
            kind=EntityKind.EVENT,
            id=r["id"],
            label=r.get("title") or "Sin título",
            sub=(r.get("starts_at") or "")[:10] or None,
        )
        for r in builder.execute().data
    ]


def _search_projects(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    builder = _rows("projects", tenant_id, "id,name", limit).order("name")
    if q:
        builder = builder.ilike("name", f"%{q}%")
    return [
        EntityHit(kind=EntityKind.PROJECT, id=r["id"], label=r.get("name") or "Sin nombre")
        for r in builder.execute().data
    ]


def _search_places(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    builder = _rows("places", tenant_id, "id,name", limit).order("name")
    if q:
        builder = builder.ilike("name", f"%{q}%")
    return [
        EntityHit(kind=EntityKind.PLACE, id=r["id"], label=r.get("name") or "Sin nombre")
        for r in builder.execute().data
    ]


def _search_opportunities(tenant_id: UUID, q: str | None, limit: int) -> list[EntityHit]:
    """Opportunities have no text of their own — resolve through their sides.

    The label a broker recognises is "person · property", both of which live in
    other tables, so a text query is answered by finding matching people and
    properties first and then the deals that point at them.
    """
    builder = _rows("opportunities", tenant_id, "id,person_id,property_id,pipeline_stage", limit)
    builder = builder.order("created_at", desc=True)

    if q:
        people_rows = _rows("contacts", tenant_id, "id,full_name", 50).ilike("full_name", f"%{q}%")
        prop_rows = _rows("properties", tenant_id, "id,title", 50).ilike("title", f"%{q}%")
        people = {r["id"]: r.get("full_name") for r in people_rows.execute().data}
        props = {r["id"]: r.get("title") for r in prop_rows.execute().data}
        if not people and not props:
            return []
        clauses = []
        if people:
            clauses.append(f"person_id.in.({','.join(people)})")
        if props:
            clauses.append(f"property_id.in.({','.join(props)})")
        builder = builder.or_(",".join(clauses))

    rows = builder.execute().data
    if not rows:
        return []

    # One lookup per side for the whole page, rather than per row.
    person_ids = [r["person_id"] for r in rows if r.get("person_id")]
    property_ids = [r["property_id"] for r in rows if r.get("property_id")]
    names: dict[str, str | None] = {}
    if person_ids:
        rows_p = _rows("contacts", tenant_id, "id,full_name", len(person_ids)).in_("id", person_ids)
        names = {r["id"]: r.get("full_name") for r in rows_p.execute().data}
    titles: dict[str, str | None] = {}
    if property_ids:
        rows_q = _rows("properties", tenant_id, "id,title", len(property_ids)).in_("id", property_ids)
        titles = {r["id"]: r.get("title") for r in rows_q.execute().data}

    hits: list[EntityHit] = []
    for r in rows:
        parts = [names.get(r.get("person_id")), titles.get(r.get("property_id"))]
        label = " · ".join(p for p in parts if p) or "Oportunidad"
        hits.append(EntityHit(kind=EntityKind.OPPORTUNITY, id=r["id"], label=label, sub=r.get("pipeline_stage")))
    return hits


_SEARCHERS = {
    EntityKind.PROPERTY: _search_properties,
    EntityKind.CONTACT: _search_contacts,
    EntityKind.OPPORTUNITY: _search_opportunities,
    EntityKind.EVENT: _search_events,
    EntityKind.PROJECT: _search_projects,
    EntityKind.PLACE: _search_places,
}


def search_entities(
    tenant_id: UUID,
    kind: EntityKind,
    q: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[EntityHit]:
    return _SEARCHERS[kind](tenant_id, q, limit)
