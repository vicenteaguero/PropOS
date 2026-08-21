"""Relationship layer of the demo workspace: identity, deal file, provenance.

Runs after ``seed_core`` and ``seed_media`` have committed. Everything here hangs
off rows those two wrote, so the ids they own are read back from the database
rather than re-derived; the ids *this* module owns come from ``demo_uuid``, so a
second run collides with the first and ``ON CONFLICT DO NOTHING`` makes it a
no-op.

What lives here is the structure the 59–64 migrations added and the older seed
never knew about: a person's second phone, who owns a property, who else is on a
deal, what a conversation is about, the numbers on a property that were actually
checked, and the file a deal becomes after the handshake.

One thing worth stating plainly: several of these tables were *backfilled by the
migration* from the singular columns they replace. A wipe deletes that backfill
and the migration will not run again, so the rows have to be produced here —
``opportunity_participants``, ``opportunity_properties``, ``conversation_targets``
and ``pipeline_transitions`` are all seeded from scratch, not merely topped up.
"""

from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta
from typing import Any

from psycopg.types.json import Jsonb

from app.features.agent.intent_registry import REGISTRY as INTENT_REGISTRY
from app.features.notifications.whatsapp.templates import REGISTRY as TEMPLATE_REGISTRY
from scripts.seed_demo.context import (
    DEMO_TENANT_ID,
    SeedContext,
    assert_safe_to_write,
    insert_many,
)
from scripts.seed_demo.core import demo_uuid


def _uid(kind: str, *parts: object) -> str:
    """Deterministic uuid for a demo row, keyed on its natural identity."""
    return demo_uuid(kind, "|".join(str(part) for part in parts))


def _load(conn: Any, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)
        return [dict(record) for record in cursor.fetchall()]


def _str_ids(rows: list[dict[str, Any]], *columns: str) -> list[dict[str, Any]]:
    """psycopg returns UUIDs; every id in this module is compared as text."""
    for row in rows:
        for column in columns:
            if row.get(column) is not None:
                row[column] = str(row[column])
    return rows


# ---------------------------------------------------------------------------
# 1. Second channels — a person is not one phone number
# ---------------------------------------------------------------------------

WORK_EMAIL_DOMAINS = ("empresa.cl", "estudiojuridico.cl", "constructora.cl", "retail.cl")
PHONE_LABELS = ("trabajo", "casa", "pareja")
EMAIL_LABELS = ("trabajo", "personal", "pareja")


def _seed_contact_channels(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    contacts: list[dict[str, Any]],
    now: datetime,
) -> None:
    """Give ~15% of contacts a second number or address.

    A slice of those second channels is deliberately a *copy* of another
    contact's primary: a couple sharing a mobile is the normal case, and it is
    the only thing that gives ``contacts_find_duplicates`` real input.
    """
    if not contacts:
        return

    pool = [c for c in contacts if c.get("phone") or c.get("email")]
    picked = [c for index, c in enumerate(pool) if (index * 7) % 47 < 7]

    phones: list[dict[str, Any]] = []
    emails: list[dict[str, Any]] = []

    for index, contact in enumerate(picked):
        # Every sixth pair shares its number with the previous contact, which is
        # what a couple looks like in a CRM.
        shares_phone = index % 6 == 5 and index > 0
        donor = picked[index - 1] if shares_phone else None

        if shares_phone and donor and donor.get("phone"):
            e164 = donor["phone"]
            label = "pareja"
        else:
            e164 = f"+562{rng.randint(22_000_000, 29_999_999)}"
            label = rng.choice(PHONE_LABELS)
        phones.append(
            {
                "id": _uid("contact_phone", contact["id"], label),
                "tenant_id": DEMO_TENANT_ID,
                "contact_id": contact["id"],
                "e164": e164,
                "label": label,
                "is_primary": False,
                "verified_at": now - timedelta(days=rng.randint(5, 300)) if rng.random() < 0.4 else None,
                "created_at": now - timedelta(days=rng.randint(1, 400)),
            }
        )

        if index % 3 != 2:
            continue
        shares_email = index % 9 == 8 and index > 0
        other = picked[index - 1] if shares_email else None
        if shares_email and other and other.get("email"):
            address = other["email"]
            label = "pareja"
        else:
            local = (contact.get("email") or "contacto@x").split("@")[0]
            address = f"{local}@{rng.choice(WORK_EMAIL_DOMAINS)}"
            label = rng.choice(EMAIL_LABELS)
        emails.append(
            {
                "id": _uid("contact_email", contact["id"], label),
                "tenant_id": DEMO_TENANT_ID,
                "contact_id": contact["id"],
                "address": address,
                "label": label,
                "is_primary": False,
                "verified_at": None,
                "created_at": now - timedelta(days=rng.randint(1, 400)),
            }
        )

    insert_many(conn, "contact_phones", phones, conflict="contact_id, e164")
    insert_many(conn, "contact_emails", emails)
    state.record("contact_phones", len(phones))
    state.record("contact_emails", len(emails))


# ---------------------------------------------------------------------------
# 2. Who owns the property
# ---------------------------------------------------------------------------

OWNER_TYPES = ("LANDOWNER", "SELLER")


def _seed_property_stakeholders(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    contacts: list[dict[str, Any]],
    author: str | None,
    now: datetime,
) -> None:
    """Every property gets an owner; some get a co-owner or an administrador."""
    owners = [c for c in contacts if c.get("type") in OWNER_TYPES] or contacts
    if not owners or not properties:
        return

    rows: list[dict[str, Any]] = []

    def add(prop: dict[str, Any], contact: dict[str, Any], role: str, share: float | None) -> None:
        rows.append(
            {
                "id": _uid("property_stakeholder", prop["id"], contact["id"], role),
                "tenant_id": DEMO_TENANT_ID,
                "property_id": prop["id"],
                "contact_id": contact["id"],
                "role": role,
                "share_pct": share,
                "created_by": author,
                "created_at": now - timedelta(days=rng.randint(10, 400)),
            }
        )

    for index, prop in enumerate(properties):
        owner = owners[(index * 13) % len(owners)]
        co_owner = owners[(index * 13 + 5) % len(owners)]
        has_co_owner = rng.random() < 0.35 and co_owner["id"] != owner["id"]

        add(prop, owner, "propietario", 60.0 if has_co_owner else 100.0)
        if has_co_owner:
            add(prop, co_owner, "copropietario", 40.0)
        if rng.random() < 0.18:
            manager = owners[(index * 13 + 9) % len(owners)]
            if manager["id"] not in (owner["id"], co_owner["id"] if has_co_owner else None):
                add(prop, manager, "administrador", None)

    insert_many(conn, "property_stakeholders", rows, conflict="property_id, contact_id, role")
    state.record("property_stakeholders", len(rows))


# ---------------------------------------------------------------------------
# 3. Who else is on the deal, and what else they looked at
# ---------------------------------------------------------------------------

COUNTERPART_ROLES = (("corredor contraparte", 0.12), ("abogado", 0.08))


def _seed_opportunity_relations(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    opportunities: list[dict[str, Any]],
    properties: list[dict[str, Any]],
    contacts: list[dict[str, Any]],
    author: str | None,
    now: datetime,
) -> None:
    """Participants and properties per deal.

    The migration seeded one row of each from the singular FKs. A wipe removes
    them and the migration does not run twice, so the singular rows are written
    here too — the extras (co-buyer, counterpart broker, the other two flats the
    buyer saw) are what make the deal look like a deal.
    """
    if not opportunities:
        return

    partners = [c for c in contacts if c.get("type") in ("BUYER", "FAMILY", "INVESTOR")] or contacts
    professionals = [c for c in contacts if c.get("type") in ("VENDOR", "NOTARY", "STAKEHOLDER")] or contacts

    participants: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []

    def add_participant(opp: dict[str, Any], contact_id: str, role: str) -> None:
        participants.append(
            {
                "id": _uid("opportunity_participant", opp["id"], contact_id, role),
                "tenant_id": DEMO_TENANT_ID,
                "opportunity_id": opp["id"],
                "contact_id": contact_id,
                "role": role,
                "created_by": author,
                "created_at": opp["created_at"],
            }
        )

    def add_property(opp: dict[str, Any], property_id: str, role: str) -> None:
        links.append(
            {
                "id": _uid("opportunity_property", opp["id"], property_id),
                "tenant_id": DEMO_TENANT_ID,
                "opportunity_id": opp["id"],
                "property_id": property_id,
                "role": role,
                "created_by": author,
                "created_at": opp["created_at"],
            }
        )

    for index, opp in enumerate(opportunities):
        if opp.get("person_id"):
            add_participant(opp, opp["person_id"], "comprador")

            if rng.random() < 0.28:
                spouse = partners[(index * 17) % len(partners)]
                if spouse["id"] != opp["person_id"]:
                    add_participant(opp, spouse["id"], "cónyuge")

            for role, probability in COUNTERPART_ROLES:
                if rng.random() >= probability:
                    continue
                professional = professionals[(index * 11 + len(role)) % len(professionals)]
                if professional["id"] != opp["person_id"]:
                    add_participant(opp, professional["id"], role)

        if not opp.get("property_id"):
            continue

        if opp.get("status") == "WON":
            main_role = "closed"
        elif opp.get("pipeline_stage") in ("OFFER", "RESERVATION"):
            main_role = "offered"
        elif opp.get("status") == "LOST":
            main_role = "discarded"
        else:
            main_role = "interest"
        add_property(opp, opp["property_id"], main_role)

        # The buyer saw three and offered on one.
        if rng.random() >= 0.30 or len(properties) < 4:
            continue
        seen: set[str] = {opp["property_id"]}
        for slot in range(rng.choice((1, 2))):
            candidate = properties[(index * 19 + slot * 7) % len(properties)]
            if candidate["id"] in seen:
                continue
            seen.add(candidate["id"])
            add_property(opp, candidate["id"], "interest")

    insert_many(conn, "opportunity_participants", participants, conflict="opportunity_id, contact_id, role")
    insert_many(conn, "opportunity_properties", links, conflict="opportunity_id, property_id")

    # Migration 61 backfilled this table with role 'interest' for every deal that
    # was not WON. The seed is what knows the stage, so the link's role is
    # corrected in place: ON CONFLICT DO NOTHING keeps the older row, and a deal
    # sitting at OFFER whose only property still says "interest" is precisely the
    # fact this column exists to carry.
    assert_safe_to_write(DEMO_TENANT_ID)
    with conn.cursor() as cursor:
        cursor.executemany(
            "UPDATE public.opportunity_properties SET role = %s"
            " WHERE opportunity_id = %s AND property_id = %s AND tenant_id = %s AND role <> %s",
            [(row["role"], row["opportunity_id"], row["property_id"], DEMO_TENANT_ID, row["role"]) for row in links],
        )

    state.record("opportunity_participants", len(participants))
    state.record("opportunity_properties", len(links))


# ---------------------------------------------------------------------------
# 4. Pipeline transitions — which moves are legal
# ---------------------------------------------------------------------------


#: Abandoning a deal is not a stage in `pipelines.stages`; it is where a deal
#: goes from wherever it was. `opportunities.status` carries it, and the
#: transition table needs the row so the guard can refuse it to the assistant.
LOST_STAGE = "LOST"


def _seed_pipeline_transitions(conn: Any, state: SeedContext) -> None:
    """Re-create what migration 61 seeded, plus the move it left out.

    Same rule the migration used — every forward move plus one step back, and
    the move into the last stage is never automatic — with the wildcard
    `NULL -> LOST` added, since a one-shot migration INSERT does not survive a
    wipe and the guard treats a pipeline with no rows as unconfigured, which
    silently turns the whole state machine off.
    """
    pipelines = _load(
        conn,
        "SELECT id, stages FROM pipelines WHERE tenant_id = %s ORDER BY id",
        (DEMO_TENANT_ID,),
    )
    walk: list[dict[str, Any]] = []
    wildcard: list[dict[str, Any]] = []
    for pipeline in _str_ids(pipelines, "id"):
        stages: list[str] = list(pipeline["stages"] or [])
        for i, from_stage in enumerate(stages):
            for j, to_stage in enumerate(stages):
                if not (j > i or j == i - 1):
                    continue
                walk.append(
                    {
                        "id": _uid("pipeline_transition", pipeline["id"], from_stage, to_stage),
                        "tenant_id": DEMO_TENANT_ID,
                        "pipeline_id": pipeline["id"],
                        "from_stage": from_stage,
                        "to_stage": to_stage,
                        # The last stage of a pipeline is the close. Never automatic.
                        "requires_human": j == len(stages) - 1,
                    }
                )
        # Losing a deal is legal from anywhere, which is what a NULL `from_stage`
        # means, and it is never the assistant's call: writing a deal off is a
        # commercial judgement with money attached.
        wildcard.append(
            {
                "id": _uid("pipeline_transition", pipeline["id"], "*", LOST_STAGE),
                "tenant_id": DEMO_TENANT_ID,
                "pipeline_id": pipeline["id"],
                "from_stage": None,
                "to_stage": LOST_STAGE,
                "requires_human": True,
            }
        )

    insert_many(conn, "pipeline_transitions", walk, conflict="pipeline_id, from_stage, to_stage")
    # The natural key cannot arbitrate a NULL `from_stage`: two NULLs are never
    # equal to Postgres, so UNIQUE would let this row in again on every run. The
    # deterministic id is what makes the wildcard idempotent.
    insert_many(conn, "pipeline_transitions", wildcard)
    state.record("pipeline_transitions", len(walk) + len(wildcard))


# ---------------------------------------------------------------------------
# 5. What a conversation is about
# ---------------------------------------------------------------------------


def _seed_conversation_targets(
    conn: Any,
    state: SeedContext,
    conversations: list[dict[str, Any]],
    opportunities: list[dict[str, Any]],
    author: str | None,
) -> None:
    """A PROPERTY target from the bot's metadata, an OPPORTUNITY one from the deal."""
    open_deal_by_contact: dict[str, dict[str, Any]] = {}
    for opp in opportunities:
        if opp.get("status") != "OPEN" or not opp.get("person_id"):
            continue
        open_deal_by_contact.setdefault(opp["person_id"], opp)

    rows: list[dict[str, Any]] = []
    for conversation in conversations:
        metadata = conversation.get("metadata") or {}
        property_id = metadata.get("property_id") if isinstance(metadata, dict) else None
        if property_id:
            rows.append(
                {
                    "id": _uid("conversation_target", conversation["id"], "property", property_id),
                    "tenant_id": DEMO_TENANT_ID,
                    "conversation_id": conversation["id"],
                    "target_kind": "PROPERTY",
                    "property_id": str(property_id),
                    "opportunity_id": None,
                    "created_by": author,
                    "created_at": conversation["created_at"],
                }
            )
        deal = open_deal_by_contact.get(conversation.get("contact_id") or "")
        if deal:
            rows.append(
                {
                    "id": _uid("conversation_target", conversation["id"], "opportunity", deal["id"]),
                    "tenant_id": DEMO_TENANT_ID,
                    "conversation_id": conversation["id"],
                    "target_kind": "OPPORTUNITY",
                    "property_id": None,
                    "opportunity_id": deal["id"],
                    "created_by": author,
                    "created_at": conversation["created_at"],
                }
            )

    # Two calls, two arbiters: the uniqueness here is a pair of PARTIAL indexes,
    # one per target kind, and Postgres will only infer a partial index when the
    # statement repeats its predicate.
    insert_many(
        conn,
        "conversation_targets",
        [row for row in rows if row["property_id"]],
        conflict="conversation_id, property_id",
        conflict_where="property_id IS NOT NULL",
    )
    insert_many(
        conn,
        "conversation_targets",
        [row for row in rows if row["opportunity_id"]],
        conflict="conversation_id, opportunity_id",
        conflict_where="opportunity_id IS NOT NULL",
    )
    state.record("conversation_targets", len(rows))


# ---------------------------------------------------------------------------
# 6. The numbers nobody has identified yet
# ---------------------------------------------------------------------------

# (whatsapp display name, turns). The bot no longer invents a contact for an
# unknown number, so these threads keep contact_id NULL and land in the
# "Sin identificar" queue with only the name WhatsApp reports.
UNIDENTIFIED_THREADS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Cata", ("Hola, vi la publicación del depto en Ñuñoa. ¿Sigue disponible?",)),
    (
        "Rodrigo M.",
        (
            "Buenas tardes, ¿me puede dar el precio de la casa de La Reina?",
            "Es para comprar, no arriendo.",
        ),
    ),
    ("Sra. Pérez", ("Buenos días, ¿ustedes administran arriendos?",)),
    (
        "Nico",
        (
            "Hola! Consulta: ¿el depto de Providencia acepta mascotas?",
            "Tengo un perro chico, pesa 6 kilos.",
        ),
    ),
    ("Fernanda 🌿", ("Hola, ¿cuánto es el pie para la oficina de Las Condes?",)),
    (
        "Papá de Javiera",
        (
            "Buenas, llamo por el arriendo que publicaron en Macul.",
            "¿Piden aval o basta con liquidaciones de sueldo?",
        ),
    ),
    ("Contacto sin nombre", ("Hola",)),
    (
        "Marcelo Constructora",
        ("Estimados, somos una constructora y queremos conversar por un proyecto en Maipú.",),
    ),
    ("Vale", ("Hola, ¿todavía tienen el local de San Miguel?",)),
    (
        "Ignacio R.",
        (
            "Hola, quería saber si se puede visitar el fin de semana.",
            "Sábado en la mañana me acomoda.",
        ),
    ),
    ("Tía Rosa", ("Buenas tardes, me pasaron su número por un arriendo en La Florida.",)),
)


def _seed_unidentified_conversations(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    now: datetime,
) -> None:
    conversations: list[dict[str, Any]] = []
    messages: list[dict[str, Any]] = []

    for index, (display_name, turns) in enumerate(UNIDENTIFIED_THREADS):
        conversation_id = _uid("unidentified_conversation", index)
        started = now - timedelta(hours=rng.randint(3, 24 * 12), minutes=rng.randrange(60))
        cursor_at = started
        for turn_index, content in enumerate(turns):
            cursor_at += timedelta(minutes=rng.randint(1, 40))
            messages.append(
                {
                    "id": _uid("unidentified_message", conversation_id, turn_index),
                    "tenant_id": DEMO_TENANT_ID,
                    "conversation_id": conversation_id,
                    "direction": "inbound",
                    "sender_type": "contact",
                    "sender_user_id": None,
                    "content": content,
                    "external_message_id": f"demo-wamid-unknown-{index:02d}-{turn_index:02d}",
                    "delivery_status": "delivered",
                    "created_at": cursor_at,
                }
            )
        conversations.append(
            {
                "id": conversation_id,
                "tenant_id": DEMO_TENANT_ID,
                "contact_id": None,
                "source": "whatsapp",
                "external_thread_id": f"demo-thread-unknown-{index:02d}",
                "external_phone_e164": f"+569{rng.randint(40_000_000, 99_999_999)}",
                "status": "open",
                "assigned_user_id": None,
                "ai_enabled": True,
                "last_inbound_at": cursor_at,
                "last_message_at": cursor_at,
                "created_at": started,
                "archived_at": None,
                "metadata": Jsonb({"demo": True, "whatsapp_name": display_name, "unidentified": True}),
            }
        )

    insert_many(conn, "client_conversations", conversations)
    insert_many(conn, "client_messages", messages)
    state.record("client_conversations", len(conversations))
    state.record("client_messages", len(messages))


# ---------------------------------------------------------------------------
# 7. Templates as data
# ---------------------------------------------------------------------------

# Two extra rows beyond the frozen registry, so the states a broker can actually
# hit — waiting to be sent to Meta, and turned down by it — are visible.
EXTRA_TEMPLATES: tuple[dict[str, Any], ...] = (
    {
        "name": "price_drop_alert",
        "category": "marketing",
        "variables": ("contact_name", "title", "new_price"),
        "body": "Hola {{1}}, bajó el precio de {{2}}: ahora {{3}}. ¿Te gustaría visitarla?",
        "approval_status": "draft",
        "external_name": None,
        "review_note": None,
    },
    {
        "name": "visit_reminder_24h",
        "category": "utility",
        "variables": ("contact_name", "property_address"),
        "body": "Hola {{1}}, te recordamos tu visita de mañana a {{2}}. ¡Te esperamos!",
        "approval_status": "rejected",
        "external_name": "visit_reminder_24h",
        "review_note": "Meta rechazó la plantilla por categoría incorrecta.",
    },
)


def _seed_message_templates(
    conn: Any,
    state: SeedContext,
    author: str | None,
    now: datetime,
) -> None:
    rows: list[dict[str, Any]] = []
    for template in TEMPLATE_REGISTRY.values():
        rows.append(
            {
                "id": _uid("message_template", template.name),
                "tenant_id": DEMO_TENANT_ID,
                "name": template.name,
                "channel": "whatsapp",
                "category": template.category,
                "language": template.language,
                "body": template.body,
                "variables": Jsonb(list(template.variables)),
                "external_name": template.name,
                "approval_status": "approved",
                "approved_at": now - timedelta(days=45),
                "created_by": author,
                "created_at": now - timedelta(days=60),
                "updated_at": now - timedelta(days=45),
            }
        )
    for extra in EXTRA_TEMPLATES:
        rows.append(
            {
                "id": _uid("message_template", extra["name"]),
                "tenant_id": DEMO_TENANT_ID,
                "name": extra["name"],
                "channel": "whatsapp",
                "category": extra["category"],
                "language": "es",
                "body": extra["body"],
                "variables": Jsonb(list(extra["variables"])),
                "external_name": extra["external_name"],
                "approval_status": extra["approval_status"],
                "approved_at": None,
                "created_by": author,
                "created_at": now - timedelta(days=12),
                "updated_at": now - timedelta(days=6),
            }
        )

    insert_many(conn, "message_templates", rows, conflict="tenant_id, name")
    state.record("message_templates", len(rows))


# ---------------------------------------------------------------------------
# 8. The checklist a deal becomes after the handshake
# ---------------------------------------------------------------------------

# (title, description, blocking, owner_role, due_offset_days, document_kind)
ChecklistItem = tuple[str, str, bool, str, int, str | None]

VENTA_ITEMS: tuple[ChecklistItem, ...] = (
    (
        "Estudio de títulos",
        "Abogado revisa 10 años de dominio y verifica que no haya vicios.",
        True,
        "abogado",
        10,
        "estudio_titulos",
    ),
    (
        "Certificado de dominio vigente",
        "Solicitar en el Conservador de Bienes Raíces correspondiente.",
        True,
        "corredor",
        5,
        "certificado_dominio",
    ),
    (
        "Certificado de hipotecas y gravámenes",
        "Confirma que la propiedad no tiene prohibiciones ni embargos.",
        True,
        "corredor",
        5,
        "certificado_gravamenes",
    ),
    (
        "Certificado de no expropiación",
        "Se pide en el municipio y en el Serviu.",
        False,
        "corredor",
        7,
        "certificado_expropiacion",
    ),
    (
        "Tasación",
        "La ordena el banco; define el monto máximo del crédito.",
        True,
        "banco",
        12,
        "tasacion",
    ),
    (
        "Aprobación del crédito hipotecario",
        "Carta de aprobación formal del banco del comprador.",
        True,
        "banco",
        25,
        "aprobacion_credito",
    ),
    (
        "Borrador de promesa de compraventa",
        "Redacción y revisión por ambas partes antes de firmar.",
        False,
        "abogado",
        15,
        "promesa",
    ),
    (
        "Firma de promesa de compraventa",
        "Firma ante notario y entrega del pie.",
        True,
        "corredor",
        20,
        "promesa",
    ),
    (
        "Escritura de compraventa",
        "Redacción, firma de ambas partes y del banco en notaría.",
        True,
        "abogado",
        45,
        "escritura",
    ),
    (
        "Inscripción en el Conservador de Bienes Raíces",
        "Sin inscripción no hay transferencia de dominio.",
        True,
        "abogado",
        60,
        "inscripcion",
    ),
    (
        "Entrega material del inmueble",
        "Acta de entrega, llaves y lectura de medidores.",
        False,
        "corredor",
        70,
        "acta_entrega",
    ),
)

ARRIENDO_ITEMS: tuple[ChecklistItem, ...] = (
    (
        "Verificación de identidad del arrendatario",
        "Cédula vigente y validación de datos.",
        True,
        "corredor",
        2,
        "cedula",
    ),
    (
        "Informe comercial",
        "Dicom / Equifax del arrendatario y del aval.",
        True,
        "corredor",
        3,
        "informe_comercial",
    ),
    (
        "Acreditación de renta",
        "Tres últimas liquidaciones de sueldo o boletas.",
        True,
        "corredor",
        4,
        "liquidaciones",
    ),
    (
        "Certificado de dominio vigente",
        "Acredita que quien arrienda es el propietario.",
        False,
        "corredor",
        5,
        "certificado_dominio",
    ),
    (
        "Aval o garantía",
        "Aval solidario o mes de garantía según el caso.",
        False,
        "corredor",
        6,
        "garantia",
    ),
    (
        "Borrador de contrato de arriendo",
        "Revisión de plazo, reajuste y gastos comunes.",
        False,
        "abogado",
        7,
        "contrato_arriendo",
    ),
    (
        "Firma de contrato de arriendo",
        "Firma de ambas partes, notarial cuando corresponde.",
        True,
        "corredor",
        10,
        "contrato_arriendo",
    ),
    (
        "Inventario y acta de entrega",
        "Estado del inmueble con fotos y lectura de medidores.",
        True,
        "corredor",
        12,
        "acta_entrega",
    ),
    (
        "Traspaso de cuentas de servicios",
        "Luz, agua, gas y gastos comunes a nombre del arrendatario.",
        False,
        "arrendatario",
        18,
        None,
    ),
)

CHECKLIST_TEMPLATES: tuple[tuple[str, str, tuple[ChecklistItem, ...]], ...] = (
    ("Cierre de venta", "venta", VENTA_ITEMS),
    ("Cierre de arriendo", "arriendo", ARRIENDO_ITEMS),
)


def _seed_checklist_templates(conn: Any, state: SeedContext, author: str | None, now: datetime) -> None:
    templates: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []

    for name, operation_kind, specs in CHECKLIST_TEMPLATES:
        template_id = _uid("checklist_template", operation_kind)
        templates.append(
            {
                "id": template_id,
                "tenant_id": DEMO_TENANT_ID,
                "name": name,
                "operation_kind": operation_kind,
                "is_default": True,
                "created_by": author,
                "created_at": now - timedelta(days=120),
                "updated_at": now - timedelta(days=120),
            }
        )
        for position, (title, description, blocking, owner_role, offset_days, document_kind) in enumerate(specs, 1):
            items.append(
                {
                    "id": _uid("checklist_template_item", operation_kind, position),
                    "tenant_id": DEMO_TENANT_ID,
                    "template_id": template_id,
                    "position": position,
                    "title": title,
                    "description": description,
                    "blocking": blocking,
                    "owner_role": owner_role,
                    "due_offset_days": offset_days,
                    "document_kind": document_kind,
                }
            )

    insert_many(conn, "checklist_templates", templates, conflict="tenant_id, name")
    insert_many(conn, "checklist_template_items", items, conflict="template_id, position")
    state.record("checklist_templates", len(templates))
    state.record("checklist_template_items", len(items))


# How far along the one instantiated expediente is: the paperwork before the
# bank is done, the credit is being chased, everything downstream is waiting.
INSTANTIATED_STATUSES = (
    "done",
    "done",
    "done",
    "done",
    "in_progress",
    "in_progress",
    "pending",
    "pending",
    "pending",
    "pending",
    "pending",
)


def _seed_expediente(
    conn: Any,
    state: SeedContext,
    opportunities: list[dict[str, Any]],
    author: str | None,
    now: datetime,
) -> str | None:
    """Instantiate the venta checklist on one deal past the handshake.

    ``RESERVATION`` is already in ``AGREEMENT_STAGES``, so the deal only needs
    ``agreed_at`` stamped — the same thing ``OpportunityService`` does on the
    transition.
    """
    candidates = [
        opp for opp in opportunities if opp.get("pipeline_stage") == "RESERVATION" and opp.get("status") == "OPEN"
    ]
    if not candidates:
        return None
    deal = candidates[0]

    assert_safe_to_write(DEMO_TENANT_ID)
    agreed_at = now - timedelta(days=18)
    with conn.cursor() as cursor:
        cursor.execute(
            "UPDATE public.opportunities SET agreed_at = %s WHERE id = %s AND tenant_id = %s",
            (agreed_at, deal["id"], DEMO_TENANT_ID),
        )

    checklist_id = _uid("opportunity_checklist", deal["id"])
    checklist_row = {
        "id": checklist_id,
        "tenant_id": DEMO_TENANT_ID,
        "opportunity_id": deal["id"],
        "template_id": _uid("checklist_template", "venta"),
        "instantiated_at": agreed_at,
    }
    insert_many(conn, "opportunity_checklists", [checklist_row], conflict="opportunity_id")

    items: list[dict[str, Any]] = []
    for position, spec in enumerate(VENTA_ITEMS, 1):
        title, description, blocking, _owner_role, offset_days, _document_kind = spec
        status = INSTANTIATED_STATUSES[position - 1]
        completed_at = agreed_at + timedelta(days=offset_days) if status == "done" else None
        items.append(
            {
                "id": _uid("opportunity_checklist_item", checklist_id, position),
                "tenant_id": DEMO_TENANT_ID,
                "checklist_id": checklist_id,
                "position": position,
                "title": title,
                "description": description,
                "status": status,
                "blocking": blocking,
                "assignee_user": author,
                "due_at": agreed_at + timedelta(days=offset_days),
                "document_id": None,
                "completed_at": completed_at,
                "completed_by": author if completed_at else None,
                "created_at": agreed_at,
                "updated_at": completed_at or agreed_at,
            }
        )

    insert_many(conn, "opportunity_checklist_items", items)
    state.record("opportunity_checklists", 1)
    state.record("opportunity_checklist_items", len(items))
    return deal["id"]


# ---------------------------------------------------------------------------
# 9. Which figures were checked, and which were only told to us
# ---------------------------------------------------------------------------

PROVENANCE_FIELDS = ("area_sqm", "list_price_cents", "rol", "year_built")


def _seed_provenance(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    now: datetime,
) -> None:
    """A third verified, a third declared, a third unknown.

    Unknown is an *absent key*, not a value: nobody wrote down where the number
    came from, and saying "unknown" out loud would be inventing a record.
    """
    assert_safe_to_write(DEMO_TENANT_ID)
    touched = 0
    with conn.cursor() as cursor:
        for index, prop in enumerate(properties):
            bucket = index % 3
            if bucket == 2:
                continue
            source = "verified" if bucket == 0 else "declared"
            checked_at = (now - timedelta(days=rng.randint(3, 240))).isoformat()
            fields = PROVENANCE_FIELDS if source == "verified" else PROVENANCE_FIELDS[:2]
            provenance = {
                field: ({"src": source, "at": checked_at} if source == "verified" else {"src": source})
                for field in fields
            }
            cursor.execute(
                "UPDATE public.properties SET provenance = %s WHERE id = %s AND tenant_id = %s",
                (Jsonb(provenance), prop["id"], DEMO_TENANT_ID),
            )
            touched += 1
    state.record("properties.provenance", touched)


# ---------------------------------------------------------------------------
# 10. Buildings — forty units at one address are not forty addresses
# ---------------------------------------------------------------------------

# (name, address, comuna, year_built, shared)
BUILDING_SPECS: tuple[tuple[str, str, str, int, dict[str, Any]], ...] = (
    (
        "Edificio Costanera Park",
        "Avenida Providencia 2145",
        "Providencia",
        2014,
        {
            "amenidades": ["piscina", "gimnasio", "quincho", "sala multiuso"],
            "gastos_comunes_base_clp": 95_000,
            "administracion": "Administra Providencia SpA",
            "conserjeria": "24 horas",
        },
    ),
    (
        "Edificio Nueva Las Condes",
        "Avenida Apoquindo 5400",
        "Las Condes",
        2019,
        {
            "amenidades": ["gimnasio", "cowork", "lavandería", "bicicletero"],
            "gastos_comunes_base_clp": 140_000,
            "administracion": "Grupo Vitacura Administraciones",
            "conserjeria": "24 horas",
        },
    ),
    (
        "Edificio Parque Ñuñoa",
        "Irarrázaval 3820",
        "Ñuñoa",
        2008,
        {
            "amenidades": ["quincho", "sala de eventos", "juegos infantiles"],
            "gastos_comunes_base_clp": 68_000,
            "administracion": "Comunidad Parque Ñuñoa",
            "conserjeria": "diurna",
        },
    ),
)


def _seed_price_history(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    now: datetime,
) -> None:
    """Walk a third of the inventory back through one or two price drops.

    `trg_property_snapshot` has been recording price and status changes since
    `20240101000027`, but the seed inserted every property once and never moved
    it, so the table was empty and the history section had nothing to render.
    The rows are written by UPDATEing the live price — going through the trigger
    rather than inserting snapshots directly, so what the screen shows is what
    production would actually produce.
    """
    assert_safe_to_write(DEMO_TENANT_ID)
    priced = [p for p in properties if p.get("list_price_cents")]
    movers = priced[: max(1, len(priced) // 3)]
    written = 0
    with conn.cursor() as cursor:
        for prop in movers:
            asking = int(prop["list_price_cents"])
            # Two drops for some, one for the rest: a listing that has been
            # reduced twice is the one a broker most needs to notice.
            drops = rng.choice((1, 1, 2))
            # Walk DOWN from the asking price, leaving the property at the last
            # step. Restoring the original price afterwards would fire the
            # trigger again and every listing would read "subió y bajó".
            price = asking
            for _ in range(drops):
                # Rounded to the nearest 100.000 CLP: nobody lists a flat at
                # $146.253.007, and the stray digits read as a bug on screen.
                price = round(price * rng.uniform(0.90, 0.97) / 100_000_00) * 100_000_00
                cursor.execute(
                    "UPDATE public.properties SET list_price_cents = %s WHERE id = %s AND tenant_id = %s",
                    (price, prop["id"], DEMO_TENANT_ID),
                )
            written += drops

    # The trigger stamps `now()`, so every drop would otherwise carry the same
    # timestamp as the seed run and read as "all reduced this second". Spread
    # them backwards IN ORDER: a plain random date per row would put the second
    # reduction of a listing before its first, and the history would contradict
    # the prices it is showing.
    with conn.cursor() as cursor:
        cursor.execute(
            """
            WITH ordered AS (
              SELECT id,
                     -- NOT created_at: it defaults to now(), which is
                     -- transaction time, so every snapshot written by this
                     -- seed shares one value and the tie broke arbitrarily —
                     -- half the listings rendered a reduction as a rise. The
                     -- ladder only ever walks down, so the recorded old price
                     -- IS the ordering: the lowest one is the most recent.
                     row_number() OVER (
                       PARTITION BY property_id
                       ORDER BY (snapshot_data->>'list_price_cents')::bigint ASC
                     ) AS rn
              FROM public.property_snapshots
              WHERE tenant_id = %s
            )
            UPDATE public.property_snapshots s
               SET snapshot_at = %s - (o.rn * interval '45 days') - (random() * interval '20 days')
              FROM ordered o
             WHERE s.id = o.id
            """,
            (DEMO_TENANT_ID, now),
        )
    state.record("property_snapshots", written)


def _seed_buildings(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    author: str | None,
    now: datetime,
) -> None:
    rows: list[dict[str, Any]] = []
    for index, (name, address, comuna, year_built, shared) in enumerate(BUILDING_SPECS):
        rows.append(
            {
                "id": _uid("building", index),
                "tenant_id": DEMO_TENANT_ID,
                "name": name,
                "address": f"{address}, {comuna}",
                "comuna": comuna,
                "place_id": None,
                "lat": None,
                "lng": None,
                "year_built": year_built,
                "shared": Jsonb(shared),
                "created_by": author,
                "created_at": now - timedelta(days=300),
                "updated_at": now - timedelta(days=300),
                "deleted_at": None,
            }
        )
    insert_many(conn, "buildings", rows, conflict="tenant_id, name")
    state.record("buildings", len(rows))

    apartments = [
        prop
        for prop in properties
        if isinstance(prop.get("metadata"), dict) and prop["metadata"].get("property_kind") == "departamento"
    ]
    if not apartments:
        return

    assert_safe_to_write(DEMO_TENANT_ID)
    # A building has ONE address, so a flat can only belong to one whose comuna
    # matches its own. Round-robin put a Recoleta flat inside a Providencia
    # tower, which made the "otras unidades" list read as nonsense the moment
    # anyone looked at it.
    by_comuna: dict[str, dict[str, Any]] = {row["comuna"]: row for row in rows}
    assigned = 0
    with conn.cursor() as cursor:
        for prop in apartments:
            metadata = prop.get("metadata") or {}
            building = by_comuna.get(metadata.get("comuna"))
            if building is None:
                continue
            floor = rng.randint(2, 18)
            # The designator only. "Departamento 181B" is what the TITLE says;
            # repeating the noun in the label makes the column that exists to
            # line units up unreadable, and it does not sort.
            unit_label = f"{floor}{rng.choice('0123')}{rng.choice('ABCD')}"
            cursor.execute(
                "UPDATE public.properties "
                # A unit cannot predate its own building. The two years were
                # drawn independently, so a 1991 flat sat inside a 2014 tower.
                "SET building_id = %s, unit_label = %s, address = %s, year_built = %s "
                "WHERE id = %s AND tenant_id = %s",
                (
                    building["id"],
                    unit_label,
                    # The unit inherits the building's street address. Leaving
                    # its own free-text address is what let forty spellings of
                    # one street exist in the first place.
                    f"{building['address']}, Depto. {unit_label}",
                    building["year_built"],
                    prop["id"],
                    DEMO_TENANT_ID,
                ),
            )
            assigned += 1
    state.record("properties.building_id", assigned)


# ---------------------------------------------------------------------------
# 11. Proposals a human still has to look at, with the quote that produced them
# ---------------------------------------------------------------------------

# (intent name, status, review_reason). The intent supplies the proposal kind and
# the target table, so a renamed intent cannot drift away from the seed.
PROPOSAL_SPECS: tuple[tuple[str, str, str | None], ...] = (
    ("create_task", "pending", None),
    ("add_note", "pending", None),
    ("log_interaction", "pending", None),
    ("create_event", "pending", None),
    ("update_person", "pending", None),
    ("create_task", "pending", None),
    ("add_note", "rejected", "dato_incorrecto"),
    ("create_event", "rejected", "entidad_equivocada"),
)

# A proposal is only judgeable next to the sentence that produced it, so the
# quote has to be ABOUT what the proposal does — an "agendar visita" card
# quoting "¿me manda más fotos?" teaches the reviewer nothing. These are the
# words the seeded arcs actually use.
INTENT_QUOTE_HINTS: dict[str, tuple[str, ...]] = {
    "create_event": ("visita", "visitar", "sábado", "jueves", "disponibilidad", "cuándo se puede ver"),
    "create_task": ("fotos", "crédito", "aval", "boletas", "liquidaciones", "cotiz"),
    "log_interaction": ("estuve en la visita", "ofrezco", "conversar", "me interesa"),
    "update_person": ("honorarios", "renta de dos", "primera vivienda", "trabajo a"),
    "add_note": ("mascota", "bodega", "quincho", "estacionamiento", "gasto común", "contribuciones"),
}

REJECTION_NOTES = {
    "dato_incorrecto": "El monto que entendió Propo no es el que dijo el cliente.",
    "entidad_equivocada": "La visita era para otra propiedad, no para esta.",
}


def _proposal_payload(intent: str, quote: str, contact_name: str, now: datetime) -> dict[str, Any]:
    first_name = contact_name.split(" ")[0] if contact_name else "cliente"
    if intent == "create_task":
        return {"title": f"Responder a {first_name}", "due": (now + timedelta(days=1)).date().isoformat()}
    if intent == "add_note":
        return {"body": quote, "person": contact_name}
    if intent == "log_interaction":
        return {"kind": "whatsapp", "summary": quote[:140], "person": contact_name}
    if intent == "create_event":
        return {
            "title": f"Visita con {first_name}",
            "starts_at": (now + timedelta(days=2)).replace(hour=11, minute=0).isoformat(),
            "person": contact_name,
        }
    return {"person": contact_name, "notes": quote[:140]}


def _pick_quotes(pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One distinct message per proposal, matched to what the proposal claims."""
    used: set[str] = set()
    chosen: list[dict[str, Any]] = []
    for intent_name, _status, _reason in PROPOSAL_SPECS:
        hints = INTENT_QUOTE_HINTS.get(intent_name, ())
        match = next(
            (
                row
                for row in pool
                if row["id"] not in used and any(hint in (row["content"] or "").lower() for hint in hints)
            ),
            None,
        )
        match = match or next((row for row in pool if row["id"] not in used), None)
        if match is None:
            break
        used.add(match["id"])
        chosen.append(match)
    return chosen


def _seed_pending_proposals(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    contacts: list[dict[str, Any]],
    author: str | None,
    now: datetime,
) -> None:
    """Proposals whose evidence quotes a message a client really sent.

    ``proposed_by_user`` is a FK into ``auth.users``: with no demo admin profile
    there is nobody to attribute a proposal to, so the whole block is skipped
    rather than attributed to somebody arbitrary.
    """
    if not author:
        print("WARN no demo admin profile — pending_proposals skipped (proposed_by_user is NOT NULL)")
        return

    pool = _load(
        conn,
        "SELECT m.conversation_id, m.id, m.content, c.contact_id"
        " FROM client_messages m"
        " JOIN client_conversations c ON c.id = m.conversation_id"
        " WHERE m.tenant_id = %s AND m.direction = 'inbound' AND c.contact_id IS NOT NULL"
        " ORDER BY m.id"
        " LIMIT 600",
        (DEMO_TENANT_ID,),
    )
    quotes = _pick_quotes(_str_ids(pool, "conversation_id", "id", "contact_id"))
    if not quotes:
        return

    name_by_contact = {c["id"]: c.get("full_name") or "" for c in contacts}

    session_id = _uid("agent_session", "whatsapp-proposals")
    insert_many(
        conn,
        "agent_sessions",
        [
            {
                "id": session_id,
                "tenant_id": DEMO_TENANT_ID,
                "user_id": author,
                "title": "Propuestas desde WhatsApp",
                "status": "OPEN",
                "metadata": Jsonb({"demo": True}),
                "started_at": now - timedelta(days=3),
                "last_activity_at": now - timedelta(hours=4),
                "closed_at": None,
                "source": "whatsapp",
                "external_thread_id": None,
            }
        ],
    )

    rows: list[dict[str, Any]] = []
    for index, (intent_name, status, review_reason) in enumerate(PROPOSAL_SPECS[: len(quotes)]):
        quote_row = quotes[index]
        spec = INTENT_REGISTRY[intent_name]
        contact_name = name_by_contact.get(quote_row["contact_id"], "")
        payload = _proposal_payload(intent_name, quote_row["content"], contact_name, now)
        created_at = now - timedelta(hours=rng.randint(2, 70))
        rows.append(
            {
                "id": _uid("pending_proposal", index),
                "tenant_id": DEMO_TENANT_ID,
                "agent_session_id": session_id,
                "proposed_by_user": author,
                "kind": spec.proposal_kind,
                "target_table": spec.target_table,
                "target_row_id": None,
                "payload": Jsonb(payload),
                "resolved_payload": Jsonb({**payload, "contact_id": quote_row["contact_id"]}),
                "ambiguity": None,
                "status": status,
                "confidence": round(rng.uniform(0.62, 0.94), 2),
                "message_id": None,
                "reviewer_user": author if status == "rejected" else None,
                "reviewed_at": created_at + timedelta(hours=2) if status == "rejected" else None,
                "review_note": REJECTION_NOTES.get(review_reason or "") or None,
                "review_reason": review_reason,
                "created_row_id": None,
                "created_at": created_at,
                "updated_at": created_at,
                "evidence": Jsonb(
                    {
                        "quote": quote_row["content"],
                        "source": "whatsapp",
                        "conversation_id": quote_row["conversation_id"],
                        "client_message_id": quote_row["id"],
                    }
                ),
            }
        )

    insert_many(conn, "pending_proposals", rows)
    state.record("agent_sessions", 1)
    state.record("pending_proposals", len(rows))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def seed_relations(conn: Any, state: SeedContext, rng_seed: int = 20260819) -> SeedContext:
    """Seed identity, deal-flow and provenance structure.

    Must run after `seed_core` and `seed_media` have committed: contacts,
    properties, opportunities and conversations are all read back from the
    database rather than invented here.
    """
    assert_safe_to_write(DEMO_TENANT_ID)
    rng = random.Random(rng_seed)
    now = datetime.now(UTC)
    author = str(state.profile_ids[0]) if state.profile_ids else None

    contacts = _str_ids(
        _load(
            conn,
            "SELECT id, full_name, type, phone, email FROM contacts"
            " WHERE tenant_id = %s AND deleted_at IS NULL ORDER BY id",
            (DEMO_TENANT_ID,),
        ),
        "id",
    )
    properties = _str_ids(
        _load(
            conn,
            "SELECT id, title, address, status, area_sqm, year_built, metadata FROM properties"
            " WHERE tenant_id = %s AND deleted_at IS NULL ORDER BY id",
            (DEMO_TENANT_ID,),
        ),
        "id",
    )
    opportunities = _str_ids(
        _load(
            conn,
            "SELECT id, person_id, property_id, pipeline_stage, status, created_at FROM opportunities"
            " WHERE tenant_id = %s AND deleted_at IS NULL ORDER BY id",
            (DEMO_TENANT_ID,),
        ),
        "id",
        "person_id",
        "property_id",
    )
    conversations = _str_ids(
        _load(
            conn,
            "SELECT id, contact_id, metadata, created_at FROM client_conversations WHERE tenant_id = %s ORDER BY id",
            (DEMO_TENANT_ID,),
        ),
        "id",
        "contact_id",
    )

    _seed_contact_channels(conn, state, rng, contacts, now)
    _seed_property_stakeholders(conn, state, rng, properties, contacts, author, now)
    _seed_opportunity_relations(conn, state, rng, opportunities, properties, contacts, author, now)
    _seed_pipeline_transitions(conn, state)
    _seed_conversation_targets(conn, state, conversations, opportunities, author)
    _seed_unidentified_conversations(conn, state, rng, now)
    _seed_message_templates(conn, state, author, now)
    _seed_checklist_templates(conn, state, author, now)
    _seed_expediente(conn, state, opportunities, author, now)
    _seed_provenance(conn, state, rng, properties, now)
    _seed_buildings(conn, state, rng, properties, author, now)
    _seed_price_history(conn, state, rng, properties, now)
    _seed_pending_proposals(conn, state, rng, contacts, author, now)
    return state
