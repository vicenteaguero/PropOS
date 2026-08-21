"""Consistency checks over a tenant's own data.

Nothing here validates the schema — the database already does that. These are
the states a database happily accepts and a brokerage cannot use: a landowner
with no property attached, a deal that points at nobody, a listing published
without a price. They accumulate silently through imports and half-finished
flows, and the first time anyone notices is when a report comes out wrong.

Each check is one count. They run on demand, not on a schedule: the point is to
answer "is my data sane right now", and a stale answer to that is worthless.
"""

from __future__ import annotations

from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.data_health.schemas import DataHealth, Finding, FindingEntity, Severity

#: Cap on rows pulled per check. Well past any real tenant, and it keeps a
#: pathological one from turning a health check into a full table scan.
_SCAN_LIMIT = 2000


def _rows(table: str, tenant_id: UUID, select: str) -> list[dict]:
    return (
        get_supabase_client()
        .table(table)
        .select(select)
        .eq("tenant_id", str(tenant_id))
        .is_("deleted_at", "null")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
    )


def check_tenant(tenant_id: UUID) -> DataHealth:
    contacts = _rows("contacts", tenant_id, "id,full_name,type,phone,email")
    properties = _rows("properties", tenant_id, "id,title,status,is_draft,list_price_cents,address")
    opportunities = _rows("opportunities", tenant_id, "id,person_id,property_id,status")
    media = (
        get_supabase_client()
        .table("media_assets")
        .select("target_row_id")
        .eq("tenant_id", str(tenant_id))
        .eq("target_table", "properties")
        .limit(_SCAN_LIMIT)
        .execute()
        .data
    )

    # An owner's link to a property is a stakeholder row, not a deal. Asking
    # "does this person have an opportunity?" and reporting no as "propietario
    # sin propiedad" flagged every owner in the book — the correct table has
    # existed since the Clientes rewrite.
    stakeholders = _rows("property_stakeholders", tenant_id, "contact_id")
    owner_linked = {s["contact_id"] for s in stakeholders if s.get("contact_id")}

    linked_people = {o["person_id"] for o in opportunities if o.get("person_id")}
    linked_properties = {o["property_id"] for o in opportunities if o.get("property_id")}
    with_photos = {m["target_row_id"] for m in media if m.get("target_row_id")}

    findings: list[Finding] = []

    def add(code: str, severity: Severity, title: str, hint: str, count: int, entity: FindingEntity | None):
        if count > 0:
            findings.append(Finding(code=code, severity=severity, title=title, hint=hint, count=count, entity=entity))

    owners_without_property = [
        c
        for c in contacts
        if (c.get("type") or "").upper() in {"LANDOWNER", "SELLER"}
        and c["id"] not in owner_linked
        and c["id"] not in linked_people
    ]
    add(
        "owner_without_property",
        Severity.WARNING,
        "Propietarios sin propiedad",
        "Vincúlalos a una propiedad para que aparezcan en su ficha.",
        len(owners_without_property),
        FindingEntity.CONTACTS,
    )

    add(
        "contact_without_channel",
        Severity.ERROR,
        "Personas sin teléfono ni correo",
        "Sin un canal de contacto no se les puede escribir ni llamar.",
        len([c for c in contacts if not c.get("phone") and not c.get("email")]),
        FindingEntity.CONTACTS,
    )

    published = [p for p in properties if not p.get("is_draft")]
    add(
        "property_without_price",
        Severity.ERROR,
        "Propiedades publicadas sin precio",
        "Una publicación sin precio no se puede cotizar ni comparar.",
        len([p for p in published if not p.get("list_price_cents")]),
        FindingEntity.PROPERTIES,
    )
    add(
        "property_without_address",
        Severity.WARNING,
        "Propiedades sin dirección",
        "Sin dirección no aparecen en el mapa.",
        len([p for p in properties if not p.get("address")]),
        FindingEntity.PROPERTIES,
    )
    add(
        "property_without_photos",
        Severity.WARNING,
        "Propiedades publicadas sin fotos",
        "Las publicaciones sin fotos reciben muchas menos visitas.",
        len([p for p in published if p["id"] not in with_photos]),
        FindingEntity.PROPERTIES,
    )

    open_opps = [o for o in opportunities if (o.get("status") or "").upper() == "OPEN"]
    add(
        "opportunity_without_property",
        Severity.WARNING,
        "Negocios sin propiedad",
        "Sin propiedad no entran en el reporte por propiedad.",
        len([o for o in open_opps if not o.get("property_id")]),
        FindingEntity.OPPORTUNITIES,
    )
    add(
        "opportunity_without_person",
        Severity.ERROR,
        "Negocios sin persona",
        "Un negocio sin contraparte no se puede seguir.",
        len([o for o in open_opps if not o.get("person_id")]),
        FindingEntity.OPPORTUNITIES,
    )
    add(
        "property_without_deal",
        Severity.WARNING,
        "Propiedades publicadas sin negocio",
        "Publicadas y sin ningún interesado registrado.",
        len([p for p in published if p["id"] not in linked_properties]),
        FindingEntity.PROPERTIES,
    )

    # Errors first, then by size: the biggest broken thing should be the first
    # thing read.
    findings.sort(key=lambda f: (f.severity != Severity.ERROR, -f.count))
    return DataHealth(findings=findings, total=sum(f.count for f in findings))
