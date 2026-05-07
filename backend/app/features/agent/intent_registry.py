"""Server-side schema registry for Anita intents.

The classifier prompt is intentionally minimal — it knows the *names* of
intents and a *universal* field vocabulary (person, property, amount,
summary, etc.). The per-intent detail (which fields exist, which are
required, how to map them onto Pydantic / DB columns) lives here.

Adding a new entity = add an ``IntentSpec`` entry. The classifier prompt
does NOT change. Token cost stays constant.

For "complex" intents (lots of attributes, e.g. ``create_property``), the
``detailed`` tuple drives an optional pass-2 LLM call that extracts the
extra fields. Pass 2 prompt is targeted (only this intent's fields),
keeping the round-trip cost cheap.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class IntentSpec:
    name: str
    proposal_kind: str
    target_table: str
    required: tuple[str, ...] = ()
    optional: tuple[str, ...] = ()
    aliases: dict[str, str] = field(default_factory=dict)
    # Pass-2-only fields: name + short description for the model.
    detailed: tuple[tuple[str, str], ...] = ()
    complex: bool = False
    defaults: dict[str, object] = field(default_factory=dict)
    # When true and required fields present + no ambiguity, dispatcher writes
    # directly to the target table instead of queuing in pending_proposals.
    # Set to False for high-stakes intents that always need human confirmation.
    auto_commit: bool = True
    # When true, dispatcher injects unprocessed media (recent photos in the
    # active session) into the payload as `media_message_ids`, so the executor
    # can attach them on commit. Used by attach_photos_to_property and
    # create_document_from_photos.
    consumes_media: bool = False

    @property
    def all_fields(self) -> tuple[str, ...]:
        return self.required + self.optional + tuple(n for n, _ in self.detailed)


REGISTRY: dict[str, IntentSpec] = {
    "log_interaction": IntentSpec(
        name="log_interaction",
        proposal_kind="propose_log_interaction",
        target_table="interactions",
        required=("kind",),
        optional=("summary", "duration_minutes", "occurred_at"),
        aliases={"duration_min": "duration_minutes", "due": "occurred_at"},
        defaults={"summary": "interacción registrada"},
    ),
    "create_person": IntentSpec(
        name="create_person",
        proposal_kind="propose_create_person",
        target_table="contacts",
        required=("full_name", "kind"),
        optional=("rut", "email", "phone", "notes"),
        defaults={"kind": "OTHER"},
    ),
    "create_task": IntentSpec(
        name="create_task",
        proposal_kind="propose_create_task",
        target_table="tasks",
        required=("title",),
        optional=("kind", "due_at", "description"),
        aliases={"task_title": "title", "due": "due_at"},
        defaults={"kind": "TODO"},
    ),
    "log_transaction": IntentSpec(
        name="log_transaction",
        proposal_kind="propose_log_transaction",
        target_table="transactions",
        required=("direction", "category", "amount"),
        optional=("currency", "description", "occurred_at"),
        aliases={"amount_clp": "amount", "due": "occurred_at"},
        defaults={"currency": "CLP"},
        auto_commit=False,
    ),
    "create_organization": IntentSpec(
        name="create_organization",
        proposal_kind="propose_create_organization",
        target_table="organizations",
        required=("name", "kind"),
        defaults={"kind": "OTHER"},
    ),
    "add_note": IntentSpec(
        name="add_note",
        proposal_kind="propose_add_note",
        target_table="notes",
        required=("body",),
    ),
    # Complex entity: triggers pass-2 schema-targeted extraction when the
    # universal-vocab pass missed details.
    "create_property": IntentSpec(
        name="create_property",
        proposal_kind="propose_create_property",
        target_table="properties",
        required=("title",),
        optional=("address", "status"),
        detailed=(
            ("comuna", "comuna chilena (ej: Las Condes, Vitacura, Curicó)"),
            ("area_m2", "metros cuadrados como entero"),
            ("bedrooms", "número de dormitorios"),
            ("bathrooms", "número de baños"),
            ("price_clp", "precio en pesos chilenos como entero"),
            ("year_built", "año de construcción"),
            ("parking_count", "número de estacionamientos"),
            ("has_storage", "true/false si tiene bodega"),
            ("hoa_clp", "gastos comunes mensuales en pesos"),
            ("orientation", "orientación N/S/E/O o combinaciones"),
            ("property_type", "casa | depto | terreno | parcela | local | bodega"),
            ("owner_name", "nombre del dueño tal cual"),
        ),
        complex=True,
        aliases={
            "size_m2": "area_m2",
            "area": "area_m2",
            "metros": "area_m2",
            "m2": "area_m2",
            "name": "title",
            "parking": "parking_count",
            "estacionamientos": "parking_count",
            "storage": "has_storage",
            "bodega": "has_storage",
            "common_expenses": "hoa_clp",
            "gastos_comunes": "hoa_clp",
            "gc": "hoa_clp",
            "year": "year_built",
            "año": "year_built",
            "price": "price_clp",
            "precio": "price_clp",
            "amount": "price_clp",
            "Comuna": "comuna",
        },
        defaults={"status": "AVAILABLE"},
    ),
    "attach_photos_to_property": IntentSpec(
        name="attach_photos_to_property",
        proposal_kind="propose_attach_photos_to_property",
        target_table="media_assets",
        required=("title",),
        aliases={"property": "title"},
        consumes_media=True,
    ),
    "create_document_from_photos": IntentSpec(
        name="create_document_from_photos",
        proposal_kind="propose_create_document_from_photos",
        target_table="documents",
        required=("title",),
        optional=("description",),
        aliases={"name": "title"},
        consumes_media=True,
    ),
    "create_campaign": IntentSpec(
        name="create_campaign",
        proposal_kind="propose_create_campaign",
        target_table="campaigns",
        required=("name", "channel"),
        optional=("budget", "currency", "start_at", "end_at"),
        detailed=(
            ("audience", "segmento objetivo"),
            ("creatives", "descripción de creatividades / formatos"),
            ("kpi", "kpi principal (CTR, leads, ROAS...)"),
        ),
        complex=True,
        defaults={"currency": "CLP"},
    ),
}


def get(intent: str) -> IntentSpec | None:
    return REGISTRY.get(intent)


_FALSY = (None, "", 0, "0", "false", False, "null", "None", "none")


def _is_falsy(v: object) -> bool:
    if isinstance(v, str):
        return v.strip().lower() in {"", "0", "false", "null", "none"}
    return v in _FALSY


def needs_pass_two(intent: str, captured: dict[str, object]) -> bool:
    """True when the intent is complex and not enough detailed fields were
    captured by the universal-vocab pass.

    Treat falsy values (None, "", 0) as "not captured" — pass 1 sometimes
    hallucinates zero defaults that would otherwise short-circuit pass 2.
    """
    spec = REGISTRY.get(intent)
    if spec is None or not spec.complex:
        return False
    detailed_names = {n for n, _ in spec.detailed}
    real = {k for k, v in captured.items() if not _is_falsy(v)}
    captured_detailed = detailed_names & real
    # Always run pass 2 unless > half the detailed fields are already captured.
    return len(captured_detailed) < max(1, len(detailed_names) // 2)


def real_captures(captured: dict[str, object]) -> dict[str, object]:
    """Strip falsy values so pass-2 prompt doesn't tell the model
    'I already have price_clp=0' and skip extracting a real price."""
    return {k: v for k, v in captured.items() if not _is_falsy(v)}


def missing_required(intent: str, fields: dict[str, object]) -> list[str]:
    """Return required fields the dispatcher didn't see (after defaults)."""
    spec = REGISTRY.get(intent)
    if spec is None:
        return []
    seen = {**spec.defaults, **fields}
    return [f for f in spec.required if f not in seen or seen[f] in (None, "")]


def normalize_fields(intent: str, fields: dict[str, object]) -> dict[str, object]:
    """Apply aliases + defaults. Returns a fresh dict; the input is untouched."""
    spec = REGISTRY.get(intent)
    if spec is None:
        return dict(fields)
    out: dict[str, object] = {**spec.defaults}
    for k, v in fields.items():
        canonical = spec.aliases.get(k, k)
        out[canonical] = v
    return out
