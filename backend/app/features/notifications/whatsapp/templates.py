"""HSM template registry.

Each entry must exist (approved) in Meta before use. Sync via
``make kapso-templates-sync``.
"""

from __future__ import annotations

from dataclasses import dataclass

# Meta template categories
# - utility: order updates, account alerts, appointment reminders (cheap)
# - marketing: promos, listing alerts (most expensive)
# - authentication: OTP, login codes


@dataclass(frozen=True)
class Template:
    name: str
    category: str
    language: str
    variables: tuple[str, ...]
    body: str


REGISTRY: dict[str, Template] = {
    "visit_confirmation": Template(
        name="visit_confirmation",
        category="utility",
        language="es",
        variables=("contact_name", "property_address", "datetime"),
        body=("Hola {{1}}, te confirmamos la visita a {{2}} el {{3}}. Si necesitas reagendar, responde este mensaje."),
    ),
    "new_listing_match": Template(
        name="new_listing_match",
        category="marketing",
        language="es",
        variables=("contact_name", "headline", "url"),
        body=("Hola {{1}}, encontramos una propiedad que coincide con tu búsqueda: {{2}}. Mira los detalles: {{3}}"),
    ),
    "proposal_accepted": Template(
        name="proposal_accepted",
        category="utility",
        language="es",
        variables=("contact_name", "summary"),
        body=("Hola {{1}}, tu propuesta fue aceptada: {{2}}. Coordinemos los próximos pasos."),
    ),
}


def get(name: str) -> Template:
    if name not in REGISTRY:
        raise KeyError(f"unknown template: {name}")
    return REGISTRY[name]


def render_variables(template: Template, vars_map: dict[str, str]) -> list[str]:
    missing = [v for v in template.variables if v not in vars_map]
    if missing:
        raise ValueError(f"template {template.name} missing vars: {missing}")
    return [str(vars_map[v]) for v in template.variables]


def list_for_tenant(tenant_id: str, channel: str = "whatsapp") -> list[dict[str, object]]:
    """Templates a tenant may actually send right now.

    Reads `message_templates`, falling back to the code REGISTRY when the table
    has no rows for this tenant — a brokerage that never configured any is not
    left with an empty picker, and the three that ship with the product keep
    working. Only `approved` ones come back: outside the 24 h window Meta
    rejects anything else, and offering a draft would be offering a failure.
    """
    from app.core.supabase.client import get_supabase_client

    rows = (
        get_supabase_client()
        .table("message_templates")
        .select("id,name,body,variables,category,language,approval_status")
        .eq("tenant_id", tenant_id)
        .eq("channel", channel)
        .eq("approval_status", "approved")
        .order("name")
        .execute()
        .data
        or []
    )
    if rows:
        return [
            {
                "name": row["name"],
                "body": row["body"],
                "variables": row.get("variables") or [],
                "category": row.get("category") or "utility",
                "language": row.get("language") or "es",
            }
            for row in rows
        ]
    return [
        {
            "name": template.name,
            "body": template.body,
            "variables": list(template.variables),
            "category": template.category,
            "language": template.language,
        }
        for template in REGISTRY.values()
    ]
