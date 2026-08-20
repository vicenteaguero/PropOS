"""Relational core of the ``PropOS Demo`` workspace.

Generates a coherent, Chilean-flavoured brokerage dataset: contacts, organizations,
places, properties, projects, pipelines, opportunities (with stage history),
interactions, tasks, events, reminders, notes and tags.

Everything is deterministic. Row ids come from ``uuid.uuid5`` over a fixed namespace,
so a second run collides with the first and ``ON CONFLICT DO NOTHING`` makes the seed
idempotent. Sibling modules (``media.py``) import the id helpers below to attach their
own rows to these entities.

The only non-deterministic input is *today*: the agenda widget needs events that are
past-today, upcoming-today, tomorrow and later this week, so calendar rows are anchored
to the wall clock at generation time. Ids stay stable, timestamps do not.

Usage is via ``scripts.seed_demo.__main__``; this module never opens a connection.
"""

from __future__ import annotations

import datetime as dt
import unicodedata
import uuid
from dataclasses import dataclass, field
from random import Random
from typing import Any
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb

from .context import (
    DEMO_TENANT_ID,
    DEMO_TENANT_NAME,
    DEMO_TENANT_SLUG,
    SeedAbortError,
    SeedContext,
    assert_safe_to_write,
    insert_many,
)

# --------------------------------------------------------------------------------------
# Deterministic id helpers — media.py imports these
# --------------------------------------------------------------------------------------

SEED_NAMESPACE = uuid.UUID("3f5b9c10-7d21-4e88-9a6f-5c1d0e2b7a44")

TZ = ZoneInfo("America/Santiago")

# Admins that should be able to switch into the demo workspace. Looked up by email;
# missing ones are skipped rather than created (auth.users is not ours to write).
DEMO_ADMIN_EMAILS = (
    "vicenteaguero@uc.cl",
    "vicente+plain@propos.dev",
    "ana@propos.dev",
    "jaime@propos.dev",
)


def demo_uuid(kind: str, key: str | int) -> str:
    """Stable uuid for ``kind``/``key`` inside the demo dataset."""
    return str(uuid.uuid5(SEED_NAMESPACE, f"{kind}:{key}"))


def person_id(index: int) -> str:
    return demo_uuid("person", index)


def organization_id(index: int) -> str:
    return demo_uuid("organization", index)


def place_id(index: int) -> str:
    return demo_uuid("place", index)


def property_id(index: int) -> str:
    return demo_uuid("property", index)


def project_id(index: int) -> str:
    return demo_uuid("project", index)


def pipeline_id(name: str) -> str:
    return demo_uuid("pipeline", name)


def opportunity_id(index: int) -> str:
    return demo_uuid("opportunity", index)


def stage_history_id(opportunity_index: int, step: int) -> str:
    return demo_uuid("stage_history", f"{opportunity_index}-{step}")


def interaction_id(index: int) -> str:
    return demo_uuid("interaction", index)


def interaction_participant_id(interaction_index: int, person_index: int) -> str:
    return demo_uuid("interaction_participant", f"{interaction_index}-{person_index}")


def interaction_target_id(interaction_index: int, slot: int) -> str:
    return demo_uuid("interaction_target", f"{interaction_index}-{slot}")


def task_id(index: int) -> str:
    return demo_uuid("task", index)


def event_id(index: int) -> str:
    return demo_uuid("event", index)


def reminder_id(index: int) -> str:
    return demo_uuid("reminder", index)


def note_id(index: int) -> str:
    return demo_uuid("note", index)


def tag_id(name: str) -> str:
    return demo_uuid("tag", name)


def tagging_id(tag_name: str, target_table: str, target_row: str) -> str:
    return demo_uuid("tagging", f"{tag_name}-{target_table}-{target_row}")


def project_property_id(project_index: int, property_index: int) -> str:
    return demo_uuid("project_property", f"{project_index}-{property_index}")


# --------------------------------------------------------------------------------------
# Chilean data primitives
# --------------------------------------------------------------------------------------


def rut_verifier(body: int) -> str:
    """Module-11 verifier digit for a RUT body."""
    total = 0
    factor = 2
    for digit in reversed(str(body)):
        total += int(digit) * factor
        factor = 2 if factor == 7 else factor + 1
    remainder = 11 - (total % 11)
    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


def format_rut(body: int) -> str:
    """RUT as ``12345678-9`` — the format ``rut_format_chk`` expects."""
    return f"{body}-{rut_verifier(body)}"


# fmt: off
FIRST_NAMES_F = (
    "María", "Camila", "Valentina", "Josefa", "Antonia", "Catalina", "Francisca",
    "Isidora", "Javiera", "Constanza", "Paula", "Daniela", "Carolina", "Fernanda",
    "Macarena", "Trinidad", "Rocío", "Bárbara", "Pilar", "Andrea", "Soledad",
    "Loreta", "Ignacia", "Magdalena", "Consuelo",
)

FIRST_NAMES_M = (
    "Juan", "José", "Matías", "Sebastián", "Cristóbal", "Diego", "Felipe", "Ignacio",
    "Vicente", "Tomás", "Benjamín", "Nicolás", "Rodrigo", "Andrés", "Pablo", "Gonzalo",
    "Álvaro", "Eduardo", "Manuel", "Joaquín", "Francisco", "Mauricio", "Patricio",
    "Hernán", "Cristián",
)

SURNAMES = (
    "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva",
    "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández",
    "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Ramírez",
    "Reyes", "Gutiérrez", "Castro", "Vargas", "Álvarez", "Vásquez", "Tapia", "Fernández",
    "Sánchez", "Carrasco", "Gómez", "Cortés", "Herrera", "Núñez", "Vergara", "Riquelme",
    "Jara", "Bravo", "Figueroa", "Orellana", "Salazar", "Campos", "Vera", "Guzmán",
    "Miranda", "Cárdenas", "Aguilera", "Zúñiga", "Leiva", "Escobar", "Yáñez", "Poblete",
    "Garrido", "Peña", "Alarcón", "Navarro", "Palma", "Sandoval",
)

# fmt: on

EMAIL_DOMAINS = ("gmail.com", "hotmail.com", "outlook.cl", "yahoo.com", "vtr.net", "uc.cl")

# type -> weight. Every value is a legal ``contact_type`` enum label.
CONTACT_TYPE_WEIGHTS = (
    ("BUYER", 44),
    ("SELLER", 20),
    ("LANDOWNER", 11),
    ("INVESTOR", 8),
    ("OTHER", 5),
    ("VENDOR", 3),
    ("STAKEHOLDER", 3),
    ("NOTARY", 2),
    ("FAMILY", 2),
    ("EMPLOYEE", 2),
)


@dataclass(frozen=True)
class Comuna:
    """A Santiago comuna with the price band the seed uses for it."""

    name: str
    price_per_sqm_clp: int
    lat: float
    lng: float


COMUNAS = (
    Comuna("Vitacura", 5_200_000, -33.3903, -70.5800),
    Comuna("Las Condes", 4_600_000, -33.4090, -70.5670),
    Comuna("Lo Barnechea", 4_400_000, -33.3510, -70.5180),
    Comuna("Providencia", 4_000_000, -33.4260, -70.6100),
    Comuna("La Reina", 3_500_000, -33.4460, -70.5400),
    Comuna("Ñuñoa", 3_400_000, -33.4560, -70.5970),
    Comuna("San Miguel", 2_700_000, -33.4960, -70.6520),
    Comuna("Santiago Centro", 2_600_000, -33.4450, -70.6540),
    Comuna("Macul", 2_500_000, -33.4900, -70.5980),
    Comuna("La Florida", 2_400_000, -33.5220, -70.5990),
    Comuna("Recoleta", 2_300_000, -33.4100, -70.6420),
    Comuna("Maipú", 2_200_000, -33.5110, -70.7580),
)

# fmt: off
STREET_NAMES = (
    "Avenida Apoquindo", "Avenida Providencia", "Irarrázaval", "Avenida Vitacura",
    "Los Leones", "Antonio Varas", "Simón Bolívar", "Pedro de Valdivia",
    "Avenida Grecia", "Departamental", "Gran Avenida", "Manuel Montt",
    "Avenida Larraín", "Tobalaba", "Bilbao", "Avenida Matta", "Santa Isabel",
    "El Bosque Norte", "Isidora Goyenechea", "Avenida Kennedy", "Las Torres",
    "Avenida Macul", "Rojas Magallanes", "Cinco de Abril",
)

# fmt: on

ORGANIZATION_SPECS = (
    ("Notaría Rojas Mena", "NOTARY"),
    ("Notaría Sepúlveda Larraín", "NOTARY"),
    ("Portal Inmobiliario", "PORTAL"),
    ("Yapo.cl", "PORTAL"),
    ("Conservador de Bienes Raíces de Santiago", "GOV"),
    ("Servicio de Impuestos Internos", "GOV"),
    ("Banco de Chile", "BANK"),
    ("Banco Santander", "BANK"),
    ("BancoEstado", "BANK"),
    ("Inmobiliaria Los Andes", "AGENCY"),
    ("Corredora Aconcagua", "BROKERAGE"),
    ("Constructora Del Valle", "CONTRACTOR"),
    ("Constructora Altiplano", "CONTRACTOR"),
    ("Muebles y Terminaciones Silva", "SUPPLIER"),
    ("Tasaciones Andrade", "OTHER"),
)

PROJECT_SPECS = (
    ("Edificio Mirador Ñuñoa", "RESIDENTIAL", "ACTIVE"),
    ("Condominio Los Aromos", "RESIDENTIAL", "ACTIVE"),
    ("Parcelación Alto Chicureo", "PARCELACION", "PLANNED"),
    ("Strip Center Macul", "COMMERCIAL_RETAIL", "ACTIVE"),
    ("Oficinas El Bosque", "OFFICE", "ON_HOLD"),
    ("Loteo Camino Lo Pinto", "LAND_SUBDIVISION", "CLOSED"),
)

PIPELINE_STAGES = ("LEAD", "QUALIFIED", "VISIT", "OFFER", "RESERVATION", "CLOSED")

# stage -> (weight, probability)
STAGE_WEIGHTS = (
    ("LEAD", 30, 10),
    ("QUALIFIED", 24, 25),
    ("VISIT", 20, 45),
    ("OFFER", 12, 65),
    ("RESERVATION", 8, 85),
    ("CLOSED", 12, 100),
)

LOST_REASONS = (
    "No consiguió el crédito hipotecario",
    "Compró con otra corredora",
    "El precio quedó fuera de su presupuesto",
    "Postergó la decisión para el próximo año",
    "No le acomodó la ubicación",
)

TAG_SPECS = (
    ("Urgente", "#ef4444"),
    ("Primera vivienda", "#3b82f6"),
    ("Inversionista", "#8b5cf6"),
    ("Crédito preaprobado", "#22c55e"),
    ("Referido", "#f59e0b"),
    ("Portal Inmobiliario", "#0ea5e9"),
    ("Instagram", "#ec4899"),
    ("Exclusiva", "#14b8a6"),
    ("Requiere remodelación", "#a16207"),
    ("Arriendo amoblado", "#6366f1"),
    ("Contactar en la tarde", "#64748b"),
    ("Cliente antiguo", "#94a3b8"),
    ("Pie insuficiente", "#f97316"),
    ("Lista para escriturar", "#10b981"),
)

INTERACTION_TEMPLATES: dict[str, tuple[tuple[str, str], ...]] = {
    "VISIT": (
        ("Visita a la propiedad", "Recorrimos la propiedad completa. Consultó por gastos comunes y orientación."),
        ("Segunda visita con la familia", "Volvió con su pareja para medir los dormitorios."),
        ("Visita coordinada con el propietario", "El propietario mostró la bodega y el estacionamiento."),
    ),
    "CALL": (
        ("Llamada de seguimiento", "Quedó de confirmar disponibilidad para visitar esta semana."),
        ("Llamada por el precio", "Preguntó si el propietario acepta una contraoferta."),
        ("Llamada de prospección", "Contacto inicial desde el formulario del portal."),
    ),
    "WHATSAPP_LOG": (
        ("Mensajes por WhatsApp", "Le envié las fotos y el plano por WhatsApp."),
        ("Coordinación por WhatsApp", "Confirmó la hora de la visita del sábado."),
        ("Consulta por WhatsApp", "Preguntó por los gastos comunes y la contribución."),
    ),
    "EMAIL": (
        ("Envío de ficha de la propiedad", "Le mandé la ficha en PDF con fotos y plano."),
        ("Correo con simulación de crédito", "Adjunté la simulación a 20 y 25 años."),
        ("Correo con documentación", "Envié copia de la escritura y el certificado de dominio vigente."),
    ),
    "MEETING": (
        ("Reunión en oficina", "Revisamos las tres alternativas que le interesan."),
        ("Reunión con el propietario", "Acordamos ajustar el precio de lista."),
        ("Reunión en notaría", "Revisión de borrador de promesa de compraventa."),
    ),
    "SHOWING": (
        ("Muestra abierta", "Open house del sábado, pasaron seis grupos."),
        ("Muestra a corredores", "Presentación de la propiedad a corredores de la zona."),
    ),
    "NOTE": (
        ("Nota de seguimiento", "Anotar que busca en un radio de diez cuadras del colegio."),
        ("Registro interno", "Prefiere que lo contacten después de las 18:00."),
    ),
    "OTHER": (("Gestión varia", "Trámite administrativo asociado al cliente."),),
}

INTERACTION_CHANNEL = {
    "VISIT": "in_person",
    "SHOWING": "in_person",
    "MEETING": "in_person",
    "CALL": "phone",
    "WHATSAPP_LOG": "whatsapp",
    "EMAIL": "email",
    "NOTE": None,
    "OTHER": None,
}

NOTE_TEMPLATES = (
    "Busca departamento de dos dormitorios cerca del metro, con estacionamiento.",
    "Tiene el crédito preaprobado por 4.500 UF en el Banco de Chile.",
    "El propietario acepta ofertas desde un 5% bajo el precio de lista.",
    "Confirmar con la administración el monto real de los gastos comunes.",
    "Prefiere entrega inmediata, se muda en marzo por el colegio de los niños.",
    "Pidió no coordinar visitas los domingos.",
    "Viene referido por un cliente antiguo de la corredora.",
    "Quiere vender para comprar algo más grande en la misma comuna.",
    "Falta el certificado de dominio vigente para publicar.",
    "Está comparando con dos propiedades de otra corredora.",
    "Le interesa arrendar mientras se decide a comprar.",
    "Pidió simulación de crédito a 25 años con 20% de pie.",
)

TASK_TEMPLATES = (
    ("Llamar para confirmar la visita", "TODO", 2),
    ("Subir las fotos nuevas a la ficha", "TODO", 1),
    ("Pedir el certificado de dominio vigente", "PENDING", 2),
    ("Preparar la carpeta para la notaría", "PENDING", 3),
    ("Enviar la simulación de crédito", "TODO", 2),
    ("Actualizar el precio de lista", "TODO", 1),
    ("Coordinar la tasación con el banco", "PENDING", 3),
    ("Revisar los gastos comunes con la administración", "TODO", 1),
    ("Publicar la propiedad en el portal", "TODO", 2),
    ("Hacer seguimiento a la oferta enviada", "TODO", 3),
    ("Cerrar tres visitas esta semana", "GOAL", 2),
    ("Duplicar las captaciones del trimestre", "OBJECTIVE", 1),
    ("Armar el plan de marketing del edificio", "PLAN", 2),
    ("Renovar el mandato de exclusividad", "PENDING", 2),
)

EVENT_TITLES_BY_KIND = {
    "VISIT": "Visita",
    "MEETING": "Reunión",
    "CALL": "Llamada",
    "DEADLINE": "Vencimiento",
    "OTHER": "Gestión",
}


# --------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------


def _slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return "".join(ch.lower() for ch in ascii_text if ch.isalnum())


def _weighted(rng: Random, choices: tuple[tuple[Any, int], ...]) -> Any:
    total = sum(weight for _, weight in choices)
    roll = rng.uniform(0, total)
    upto = 0.0
    for value, weight in choices:
        upto += weight
        if roll <= upto:
            return value
    return choices[-1][0]


def _business_time(rng: Random, day: dt.date) -> dt.datetime:
    """A plausible working-hours timestamp on ``day``."""
    hour = rng.choice((9, 10, 10, 11, 11, 12, 15, 16, 16, 17, 17, 18, 19))
    minute = rng.choice((0, 0, 15, 30, 30, 45))
    return dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)


def _weekday_biased_day(rng: Random, now: dt.datetime, max_days_ago: int, min_days_ago: int = 0) -> dt.date:
    """Pick a past day, resampling most weekend draws so activity clusters Mon–Fri."""
    for _ in range(4):
        day = (now - dt.timedelta(days=rng.randint(min_days_ago, max_days_ago))).date()
        if day.weekday() < 5 or rng.random() < 0.15:
            return day
    return day


def _jitter(rng: Random, value: float, pct: float) -> float:
    return value * (1 + rng.uniform(-pct, pct))


# --------------------------------------------------------------------------------------
# Generated-entity records (internal, not DB rows)
# --------------------------------------------------------------------------------------


@dataclass
class GeneratedPerson:
    index: int
    id: str
    full_name: str
    type: str
    created_at: dt.datetime


@dataclass
class GeneratedProperty:
    index: int
    id: str
    title: str
    comuna: str
    listing_kind: str
    status: str
    price_cents: int
    created_at: dt.datetime


@dataclass
class GeneratedOpportunity:
    index: int
    id: str
    person: GeneratedPerson
    property: GeneratedProperty | None
    stage: str
    status: str
    created_at: dt.datetime


@dataclass
class SeedPlan:
    """Ordered ``(table, rows)`` pairs plus the ids the rest of the seed needs."""

    tables: list[tuple[str, list[dict[str, Any]]]] = field(default_factory=list)
    person_ids: list[str] = field(default_factory=list)
    property_ids: list[str] = field(default_factory=list)
    organization_ids: list[str] = field(default_factory=list)
    project_ids: list[str] = field(default_factory=list)
    opportunity_ids: list[str] = field(default_factory=list)
    interaction_ids: list[str] = field(default_factory=list)
    profile_ids: list[str] = field(default_factory=list)

    def add(self, table: str, rows: list[dict[str, Any]]) -> None:
        self.tables.append((table, rows))


# --------------------------------------------------------------------------------------
# Builders
# --------------------------------------------------------------------------------------


def _build_people(
    rng: Random, now: dt.datetime, author: str | None, count: int
) -> tuple[list[dict], list[GeneratedPerson]]:
    rows: list[dict] = []
    generated: list[GeneratedPerson] = []
    used_ruts: set[int] = set()
    used_emails: set[str] = set()

    for index in range(count):
        if rng.random() < 0.52:
            first = rng.choice(FIRST_NAMES_F)
        else:
            first = rng.choice(FIRST_NAMES_M)
        paternal = rng.choice(SURNAMES)
        maternal = rng.choice(SURNAMES)
        full_name = f"{first} {paternal} {maternal}"

        while True:
            body = rng.randint(6_000_000, 25_500_000)
            if body not in used_ruts:
                used_ruts.add(body)
                break

        local = f"{_slugify(first)}.{_slugify(paternal)}"
        email = f"{local}@{rng.choice(EMAIL_DOMAINS)}"
        suffix = 1
        while email in used_emails:
            suffix += 1
            email = f"{local}{suffix}@{rng.choice(EMAIL_DOMAINS)}"
        used_emails.add(email)

        created_at = _business_time(rng, _weekday_biased_day(rng, now, 540, 1))
        comuna = rng.choice(COMUNAS)
        contact_type = _weighted(rng, CONTACT_TYPE_WEIGHTS)

        rows.append(
            {
                "id": person_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "full_name": full_name,
                "email": email,
                "phone": f"+569{rng.randint(10_000_000, 99_999_999)}",
                "type": contact_type,
                "is_draft": False,
                "created_by": author,
                "created_at": created_at,
                "updated_at": created_at,
                "rut": format_rut(body),
                "birthdate": dt.date(rng.randint(1955, 2002), rng.randint(1, 12), rng.randint(1, 28)),
                "address": f"{rng.choice(STREET_NAMES)} {rng.randint(100, 8900)}, {comuna.name}",
                "notes": None,
                "metadata": {"seed": "demo", "comuna": comuna.name},
            }
        )
        generated.append(
            GeneratedPerson(
                index=index, id=person_id(index), full_name=full_name, type=contact_type, created_at=created_at
            )
        )

    generated.sort(key=lambda person: person.created_at)
    return rows, generated


def _build_organizations(rng: Random, now: dt.datetime, author: str | None) -> list[dict]:
    rows: list[dict] = []
    for index, (name, kind) in enumerate(ORGANIZATION_SPECS):
        created_at = _business_time(rng, _weekday_biased_day(rng, now, 500, 30))
        rows.append(
            {
                "id": organization_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "name": name,
                "kind": kind,
                "rut": format_rut(rng.randint(70_000_000, 96_000_000)),
                "website": f"https://www.{_slugify(name)[:24]}.cl",
                "email": f"contacto@{_slugify(name)[:24]}.cl",
                "phone": f"+562{rng.randint(20_000_000, 29_999_999)}",
                "address": f"{rng.choice(STREET_NAMES)} {rng.randint(100, 3000)}, {rng.choice(COMUNAS).name}",
                "notes": None,
                "metadata": {"seed": "demo"},
                "created_by": author,
                "created_at": created_at,
                "updated_at": created_at,
            }
        )
    return rows


def _link_people_to_organizations(rng: Random, people_rows: list[dict], organization_rows: list[dict]) -> int:
    """Attach a subset of contacts to an organization.

    ``contacts`` has no ``organization_id`` column, so the link lives in ``metadata``
    where the UI and the agent can still read it. Returns how many rows were touched.
    """
    linked = 0
    for row in people_rows:
        if row["type"] not in ("NOTARY", "VENDOR", "STAKEHOLDER", "EMPLOYEE", "INVESTOR"):
            continue
        if rng.random() > 0.7:
            continue
        organization = rng.choice(organization_rows)
        row["metadata"] = {
            **row["metadata"],
            "organization_id": organization["id"],
            "organization_name": organization["name"],
        }
        linked += 1
    return linked


def _property_shape(rng: Random) -> dict[str, Any]:
    kind = _weighted(
        rng,
        (("departamento", 55), ("casa", 28), ("oficina", 9), ("local", 8)),
    )
    if kind == "departamento":
        bedrooms = _weighted(rng, ((0, 8), (1, 20), (2, 40), (3, 27), (4, 5)))
        area = {
            0: rng.randint(28, 42),
            1: rng.randint(38, 58),
            2: rng.randint(55, 85),
            3: rng.randint(80, 125),
            4: rng.randint(115, 160),
        }[bedrooms]
        bathrooms = max(1, min(3, bedrooms))
        lot = None
        label = "Studio" if bedrooms == 0 else f"Departamento {bedrooms}D/{bathrooms}B"
    elif kind == "casa":
        bedrooms = rng.randint(3, 5)
        area = rng.randint(95, 265)
        bathrooms = rng.randint(2, 4)
        lot = round(area * rng.uniform(1.6, 3.4), 2)
        label = f"Casa {bedrooms}D/{bathrooms}B"
    elif kind == "oficina":
        bedrooms = 0
        area = rng.randint(35, 220)
        bathrooms = rng.randint(1, 2)
        lot = None
        label = "Oficina"
    else:
        bedrooms = 0
        area = rng.randint(40, 180)
        bathrooms = 1
        lot = None
        label = "Local comercial"
    return {
        "kind": kind,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "area_sqm": float(area),
        "lot_sqm": lot,
        "label": label,
    }


def _build_places_and_properties(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    organization_rows: list[dict],
    count: int,
) -> tuple[list[dict], list[dict], list[GeneratedProperty]]:
    place_rows: list[dict] = []
    property_rows: list[dict] = []
    generated: list[GeneratedProperty] = []

    for index in range(count):
        comuna = rng.choice(COMUNAS)
        shape = _property_shape(rng)
        street = rng.choice(STREET_NAMES)
        number = rng.randint(120, 9800)
        unit = f", Depto. {rng.randint(1, 24)}{rng.choice('ABCD')}" if shape["kind"] == "departamento" else ""
        address = f"{street} {number}{unit}, {comuna.name}"
        lat = round(comuna.lat + rng.uniform(-0.012, 0.012), 6)
        lng = round(comuna.lng + rng.uniform(-0.014, 0.014), 6)

        created_at = _business_time(rng, _weekday_biased_day(rng, now, 420, 3))
        listing_kind = _weighted(rng, (("SALE", 76), ("RENT", 20), ("LEASE", 4)))
        sale_price = shape["area_sqm"] * comuna.price_per_sqm_clp
        if shape["kind"] in ("oficina", "local"):
            sale_price *= 0.85
        if listing_kind == "SALE":
            price_clp = round(_jitter(rng, sale_price, 0.12), -5)
        else:
            price_clp = round(_jitter(rng, sale_price * 0.0042, 0.12), -3)

        status = _weighted(rng, (("AVAILABLE", 60), ("RESERVED", 12), ("SOLD", 20), ("INACTIVE", 8)))
        if listing_kind != "SALE" and status == "SOLD":
            status = "RESERVED"

        place_rows.append(
            {
                "id": place_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "name": f"{shape['label']} — {comuna.name}",
                "address": address,
                "city": comuna.name,
                "region": "Región Metropolitana",
                "country": "CL",
                "lat": lat,
                "lng": lng,
                "organization_id": None,
                "metadata": {"seed": "demo", "property_id": property_id(index)},
                "created_by": author,
                "created_at": created_at,
                "updated_at": created_at,
            }
        )

        verb = "en venta" if listing_kind == "SALE" else "en arriendo"
        property_rows.append(
            {
                "id": property_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "title": f"{shape['label']} {verb} en {comuna.name}",
                "address": address,
                "status": status,
                "is_draft": False,
                "created_by": author,
                "created_at": created_at,
                "updated_at": created_at,
                "description": (
                    f"{shape['label']} de {shape['area_sqm']:.0f} m² en {comuna.name}. "
                    f"{'Cuenta con estacionamiento y bodega. ' if rng.random() < 0.6 else ''}"
                    "Cerca de colegios, comercio y locomoción."
                ),
                "bedrooms": shape["bedrooms"],
                "bathrooms": shape["bathrooms"],
                "area_sqm": shape["area_sqm"],
                "lot_sqm": shape["lot_sqm"],
                "list_price_cents": int(price_clp) * 100,
                "currency": "CLP",
                "listing_kind": listing_kind,
                "lat": lat,
                "lng": lng,
                "year_built": rng.randint(1972, 2025),
                "project_id": None,
                "on_market_at": created_at if status in ("AVAILABLE", "RESERVED") else None,
                "off_market_at": None,
                "metadata": {"seed": "demo", "comuna": comuna.name, "property_kind": shape["kind"]},
            }
        )
        generated.append(
            GeneratedProperty(
                index=index,
                id=property_id(index),
                title=property_rows[-1]["title"],
                comuna=comuna.name,
                listing_kind=listing_kind,
                status=status,
                price_cents=property_rows[-1]["list_price_cents"],
                created_at=created_at,
            )
        )

    # A couple of places belong to partner organizations (notary offices, banks).
    for place_row, organization in zip(place_rows[:4], organization_rows[:4], strict=False):
        place_row["organization_id"] = organization["id"]

    return place_rows, property_rows, generated


def _build_projects(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    place_rows: list[dict],
    properties: list[GeneratedProperty],
    property_rows: list[dict],
) -> tuple[list[dict], list[dict]]:
    project_rows: list[dict] = []
    link_rows: list[dict] = []
    rows_by_id = {row["id"]: row for row in property_rows}

    for index, (name, kind, status) in enumerate(PROJECT_SPECS):
        start = (now - dt.timedelta(days=rng.randint(200, 700))).date()
        end = start + dt.timedelta(days=rng.randint(300, 900))
        project_rows.append(
            {
                "id": project_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "name": name,
                "kind": kind,
                "status": status,
                "description": f"Proyecto {name.lower()} gestionado por la corredora.",
                "start_date": start,
                "end_date": end if status in ("CLOSED", "ARCHIVED") else None,
                "parent_project_id": None,
                "primary_place_id": place_rows[index]["id"],
                "metadata": {"seed": "demo"},
                "created_by": author,
                "created_at": _business_time(rng, start),
                "updated_at": _business_time(rng, start),
            }
        )

    # Roughly a third of the portfolio hangs off a project.
    pool = list(properties)
    rng.shuffle(pool)
    assigned = pool[: int(len(pool) * 0.35)]
    for prop in assigned:
        index = rng.randrange(len(PROJECT_SPECS))
        link_rows.append(
            {
                "id": project_property_id(index, prop.index),
                "tenant_id": DEMO_TENANT_ID,
                "project_id": project_id(index),
                "property_id": prop.id,
                "role": rng.choice(("unit", "unit", "common_area", "showroom")),
            }
        )
        rows_by_id[prop.id]["project_id"] = project_id(index)

    return project_rows, link_rows


def _build_pipelines() -> list[dict]:
    return [
        {
            "id": pipeline_id("ventas"),
            "tenant_id": DEMO_TENANT_ID,
            "name": "Ventas",
            "stages": list(PIPELINE_STAGES),
            "is_default": True,
        },
        {
            "id": pipeline_id("arriendos"),
            "tenant_id": DEMO_TENANT_ID,
            "name": "Arriendos",
            "stages": list(PIPELINE_STAGES),
            "is_default": False,
        },
    ]


def _build_opportunities(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    people: list[GeneratedPerson],
    properties: list[GeneratedProperty],
    count: int,
) -> tuple[list[dict], list[dict], list[GeneratedOpportunity]]:
    opportunity_rows: list[dict] = []
    history_rows: list[dict] = []
    generated: list[GeneratedOpportunity] = []

    buyers = [person for person in people if person.type in ("BUYER", "INVESTOR")] or people
    sale_properties = [prop for prop in properties if prop.listing_kind == "SALE"]
    rent_properties = [prop for prop in properties if prop.listing_kind != "SALE"]

    # Guarantee at least one opportunity per stage before falling back to the weights.
    forced_stages = list(PIPELINE_STAGES) * 2
    probability_by_stage = {name: prob for name, _, prob in STAGE_WEIGHTS}

    for index in range(count):
        person = rng.choice(buyers)
        is_rent = rng.random() < 0.2 and rent_properties
        prop = (
            rng.choice(rent_properties if is_rent else sale_properties)
            if (rent_properties or sale_properties)
            else None
        )

        if index < len(forced_stages):
            stage = forced_stages[index]
        else:
            stage = _weighted(rng, tuple((name, weight) for name, weight, _ in STAGE_WEIGHTS))
        probability = probability_by_stage[stage]

        stage_index = PIPELINE_STAGES.index(stage)
        # Older opportunities have had time to advance; keep created_at after the person.
        age_days = rng.randint(5 + stage_index * 20, 40 + stage_index * 40)
        created_at = _business_time(
            rng, _weekday_biased_day(rng, now, min(age_days, 240), max(1, min(age_days, 240) - 1))
        )
        if created_at < person.created_at:
            created_at = person.created_at + dt.timedelta(days=rng.randint(1, 20))
        if created_at > now:
            created_at = now - dt.timedelta(days=1)

        if stage == "CLOSED":
            status = "WON"
        elif rng.random() < 0.09:
            status = "LOST"
        else:
            status = "OPEN"

        closed_at = None
        if status != "OPEN":
            closed_at = min(
                now - dt.timedelta(hours=rng.randint(2, 240)), created_at + dt.timedelta(days=rng.randint(20, 160))
            )
            if closed_at < created_at:
                closed_at = created_at + dt.timedelta(days=3)

        value_cents = prop.price_cents if prop else rng.randint(80_000_000, 400_000_000) * 100
        opportunity_rows.append(
            {
                "id": opportunity_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "pipeline_id": pipeline_id("arriendos" if is_rent else "ventas"),
                "person_id": person.id,
                "property_id": prop.id if prop else None,
                "project_id": None,
                "pipeline_stage": stage,
                "status": status,
                "expected_close_at": (created_at + dt.timedelta(days=rng.randint(30, 180))).date(),
                "expected_value_cents": value_cents,
                "currency": "CLP",
                "probability": probability,
                "lost_reason": rng.choice(LOST_REASONS) if status == "LOST" else None,
                "notes": None,
                "metadata": {"seed": "demo"},
                "source": rng.choice(("manual", "manual", "manual", "import")),
                "created_by": author,
                "created_at": created_at,
                "updated_at": closed_at or now,
                "closed_at": closed_at,
            }
        )

        # Stage history: LEAD -> ... -> current stage, monotonically increasing.
        cursor = created_at
        span = ((closed_at or now) - created_at) / max(stage_index + 1, 1)
        history_rows.append(
            {
                "id": stage_history_id(index, 0),
                "tenant_id": DEMO_TENANT_ID,
                "opportunity_id": opportunity_id(index),
                "from_stage": None,
                "to_stage": "LEAD",
                "note": "Oportunidad creada",
                "changed_by": author,
                "changed_at": cursor,
            }
        )
        for step in range(1, stage_index + 1):
            cursor = cursor + span * rng.uniform(0.6, 1.0)
            history_rows.append(
                {
                    "id": stage_history_id(index, step),
                    "tenant_id": DEMO_TENANT_ID,
                    "opportunity_id": opportunity_id(index),
                    "from_stage": PIPELINE_STAGES[step - 1],
                    "to_stage": PIPELINE_STAGES[step],
                    "note": f"Avanza a {PIPELINE_STAGES[step]}",
                    "changed_by": author,
                    "changed_at": cursor,
                }
            )

        generated.append(
            GeneratedOpportunity(
                index=index,
                id=opportunity_id(index),
                person=person,
                property=prop,
                stage=stage,
                status=status,
                created_at=created_at,
            )
        )

    return opportunity_rows, history_rows, generated


def _build_interactions(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    people: list[GeneratedPerson],
    properties: list[GeneratedProperty],
    opportunities: list[GeneratedOpportunity],
    loose_count: int,
) -> tuple[
    list[dict], list[dict], list[dict], list[tuple[int, dt.datetime, GeneratedProperty | None, GeneratedPerson]]
]:
    interaction_rows: list[dict] = []
    participant_rows: list[dict] = []
    target_rows: list[dict] = []
    visits: list[tuple[int, dt.datetime, GeneratedProperty | None, GeneratedPerson]] = []

    cursor = 0

    def emit(
        kind: str,
        occurred_at: dt.datetime,
        person: GeneratedPerson,
        prop: GeneratedProperty | None,
        opportunity: GeneratedOpportunity | None,
    ) -> None:
        nonlocal cursor
        index = cursor
        cursor += 1
        summary, body = rng.choice(INTERACTION_TEMPLATES[kind])
        interaction_rows.append(
            {
                "id": interaction_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "kind": kind,
                "occurred_at": occurred_at,
                "duration_minutes": rng.choice((5, 10, 15, 20, 30, 45, 60)) if kind != "NOTE" else None,
                "channel": INTERACTION_CHANNEL[kind],
                "summary": summary,
                "body": body,
                "sentiment": _weighted(rng, (("POSITIVE", 45), ("NEUTRAL", 45), ("NEGATIVE", 10))),
                "source": rng.choice(("manual", "manual", "manual", "agent", "import")),
                "raw_transcript_id": None,
                "created_by": author,
                "created_at": occurred_at,
                "updated_at": occurred_at,
                "audience_caps": {},
            }
        )
        participant_rows.append(
            {
                "id": interaction_participant_id(index, person.index),
                "tenant_id": DEMO_TENANT_ID,
                "interaction_id": interaction_id(index),
                "person_id": person.id,
                "role": "client",
            }
        )
        slot = 0
        if opportunity is not None:
            target_rows.append(
                {
                    "id": interaction_target_id(index, slot),
                    "tenant_id": DEMO_TENANT_ID,
                    "interaction_id": interaction_id(index),
                    "target_kind": "OPPORTUNITY",
                    "property_id": None,
                    "place_id": None,
                    "project_id": None,
                    "opportunity_id": opportunity.id,
                }
            )
            slot += 1
        if prop is not None:
            target_rows.append(
                {
                    "id": interaction_target_id(index, slot),
                    "tenant_id": DEMO_TENANT_ID,
                    "interaction_id": interaction_id(index),
                    "target_kind": "PROPERTY",
                    "property_id": prop.id,
                    "place_id": None,
                    "project_id": None,
                    "opportunity_id": None,
                }
            )
        if kind in ("VISIT", "SHOWING"):
            visits.append((index, occurred_at, prop, person))

    # Opportunity-driven activity: the further along the deal, the longer its trail.
    for opportunity in opportunities:
        stage_index = PIPELINE_STAGES.index(opportunity.stage)
        for _ in range(1 + stage_index + rng.randint(0, 2)):
            window = max((now - opportunity.created_at).days, 1)
            occurred_at = _business_time(rng, _weekday_biased_day(rng, now, min(window, 365), 0))
            if occurred_at < opportunity.created_at:
                occurred_at = opportunity.created_at + dt.timedelta(hours=rng.randint(2, 72))
            if occurred_at > now:
                occurred_at = now - dt.timedelta(hours=rng.randint(1, 48))
            kind = _weighted(
                rng,
                (
                    ("CALL", 26),
                    ("WHATSAPP_LOG", 24),
                    ("EMAIL", 18),
                    ("VISIT", 16),
                    ("MEETING", 9),
                    ("SHOWING", 4),
                    ("NOTE", 3),
                ),
            )
            emit(kind, occurred_at, opportunity.person, opportunity.property, opportunity)

    # Loose activity not tied to any deal.
    for _ in range(loose_count):
        person = rng.choice(people)
        occurred_at = _business_time(rng, _weekday_biased_day(rng, now, 365, 0))
        if occurred_at < person.created_at:
            occurred_at = person.created_at + dt.timedelta(days=rng.randint(1, 10))
        if occurred_at > now:
            occurred_at = now - dt.timedelta(hours=rng.randint(1, 72))
        prop = rng.choice(properties) if rng.random() < 0.55 else None
        kind = _weighted(
            rng,
            (
                ("CALL", 28),
                ("WHATSAPP_LOG", 26),
                ("EMAIL", 20),
                ("NOTE", 10),
                ("VISIT", 8),
                ("MEETING", 6),
                ("OTHER", 2),
            ),
        )
        emit(kind, occurred_at, person, prop, None)

    return interaction_rows, participant_rows, target_rows, visits


def _build_events_and_tasks(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    people: list[GeneratedPerson],
    properties: list[GeneratedProperty],
    visits: list[tuple[int, dt.datetime, GeneratedProperty | None, GeneratedPerson]],
    task_count: int,
) -> tuple[list[dict], list[dict]]:
    event_rows: list[dict] = []
    task_rows: list[dict] = []
    today = now.date()

    def add_event(
        kind: str,
        starts_at: dt.datetime,
        status: str,
        person: GeneratedPerson | None,
        prop: GeneratedProperty | None,
        duration_minutes: int = 45,
    ) -> str:
        index = len(event_rows)
        where = prop.comuna if prop else "oficina"
        title = f"{EVENT_TITLES_BY_KIND[kind]} — {person.full_name.split()[0] if person else where}"
        if prop is not None:
            title = f"{EVENT_TITLES_BY_KIND[kind]} — {prop.title.split(' en ')[0]}, {prop.comuna}"
        event_rows.append(
            {
                "id": event_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "kind": kind,
                "title": title[:180],
                "description": f"Agendado con {person.full_name}." if person else None,
                "starts_at": starts_at,
                "ends_at": starts_at + dt.timedelta(minutes=duration_minutes),
                "all_day": False,
                "location": prop.title if prop else "Oficina de la corredora",
                "status": status,
                "property_id": prop.id if prop else None,
                "contact_id": person.id if person else None,
                "project_id": None,
                "assignee_user": author,
                "source": "manual",
                "created_by": author,
                "created_at": starts_at - dt.timedelta(days=rng.randint(1, 12)),
                "updated_at": starts_at,
            }
        )
        return event_id(index)

    # 1. Past visits mirror the interactions that already happened.
    rng.shuffle(visits)
    for _, occurred_at, prop, person in visits[:150]:
        add_event("VISIT", occurred_at, "DONE", person, prop)

    # 2. Today — fixed slots across the whole day plus two anchored to the current
    #    time, so the agenda widget always has a "next event today" to show no matter
    #    what hour the seed runs at. The "day already finished" state appears on its
    #    own once the clock passes the last slot.
    for hour, minute in ((8, 30), (10, 0), (12, 0), (15, 30), (17, 0), (19, 0)):
        starts_at = dt.datetime(today.year, today.month, today.day, hour, minute, tzinfo=TZ)
        add_event(
            rng.choice(("VISIT", "CALL", "MEETING")),
            starts_at,
            "DONE" if starts_at < now else "SCHEDULED",
            rng.choice(people),
            rng.choice(properties),
        )
    for minutes_ahead in (75, 200):
        starts_at = (now + dt.timedelta(minutes=minutes_ahead)).replace(second=0, microsecond=0)
        starts_at -= dt.timedelta(minutes=starts_at.minute % 15)
        if starts_at.date() != today:
            continue
        add_event("VISIT", starts_at, "SCHEDULED", rng.choice(people), rng.choice(properties))

    # 3. Tomorrow and the rest of the week.
    for offset in (1, 1, 1, 2, 3, 4, 5, 6, 7):
        day = today + dt.timedelta(days=offset)
        add_event(
            _weighted(rng, (("VISIT", 50), ("MEETING", 25), ("CALL", 20), ("DEADLINE", 5))),
            _business_time(rng, day),
            "SCHEDULED",
            rng.choice(people),
            rng.choice(properties),
        )

    # 4. The rest of the month plus a few cancellations.
    while len(event_rows) < 300:
        offset = rng.randint(8, 45)
        day = today + dt.timedelta(days=offset)
        if day.weekday() >= 5 and rng.random() < 0.8:
            continue
        add_event(
            _weighted(rng, (("VISIT", 45), ("MEETING", 25), ("CALL", 18), ("DEADLINE", 7), ("OTHER", 5))),
            _business_time(rng, day),
            "CANCELLED" if rng.random() < 0.08 else "SCHEDULED",
            rng.choice(people),
            rng.choice(properties),
        )

    # Tasks: half of them prepare an upcoming event, the rest are standalone.
    upcoming = [row for row in event_rows if row["starts_at"] >= now and row["status"] == "SCHEDULED"]
    rng.shuffle(upcoming)
    for event_row in upcoming[: task_count // 2]:
        index = len(task_rows)
        due_at = event_row["starts_at"] - dt.timedelta(hours=rng.randint(2, 30))
        task_rows.append(
            {
                "id": task_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "kind": "TODO",
                "title": f"Preparar: {event_row['title']}"[:180],
                "description": f"Revisar ficha y documentos antes de «{event_row['title']}».",
                "status": "OPEN" if due_at > now else "IN_PROGRESS",
                "priority": rng.randint(1, 3),
                "due_at": due_at,
                "completed_at": None,
                "parent_task_id": None,
                "owner_user": author,
                "related": {"events": [event_row["id"]]},
                "source": "manual",
                "created_by": author,
                "created_at": min(now, due_at) - dt.timedelta(days=rng.randint(1, 6)),
                "updated_at": now,
            }
        )

    while len(task_rows) < task_count:
        index = len(task_rows)
        title, kind, priority = rng.choice(TASK_TEMPLATES)
        due_at = _business_time(rng, today + dt.timedelta(days=rng.randint(-90, 21)))
        if due_at < now:
            status = _weighted(rng, (("DONE", 62), ("OPEN", 16), ("BLOCKED", 8), ("CANCELLED", 6), ("IN_PROGRESS", 8)))
        else:
            status = _weighted(rng, (("OPEN", 70), ("IN_PROGRESS", 24), ("BLOCKED", 6)))
        prop = rng.choice(properties) if rng.random() < 0.6 else None
        task_rows.append(
            {
                "id": task_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "kind": kind,
                "title": f"{title} — {prop.comuna}" if prop else title,
                "description": None,
                "status": status,
                "priority": priority,
                "due_at": due_at,
                "completed_at": due_at + dt.timedelta(hours=rng.randint(1, 20)) if status == "DONE" else None,
                "parent_task_id": None,
                "owner_user": author,
                "related": {"properties": [prop.id]} if prop else {},
                "source": rng.choice(("manual", "manual", "agent")),
                "created_by": author,
                "created_at": due_at - dt.timedelta(days=rng.randint(1, 14)),
                "updated_at": now,
            }
        )

    return event_rows, task_rows


def _build_reminders(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    event_rows: list[dict],
    task_rows: list[dict],
    count: int,
) -> list[dict]:
    """Reminders need a real ``auth.users`` id; without one we skip the table."""
    if author is None:
        return []

    rows: list[dict] = []
    upcoming_events = [row for row in event_rows if row["starts_at"] >= now]
    open_tasks = [row for row in task_rows if row["due_at"] and row["status"] in ("OPEN", "IN_PROGRESS")]

    candidates = [("events", row["id"], row["starts_at"], row["title"]) for row in upcoming_events]
    candidates += [("tasks", row["id"], row["due_at"], row["title"]) for row in open_tasks]
    rng.shuffle(candidates)

    for index, (target_table, target_row_id, at, title) in enumerate(candidates[:count]):
        remind_at = at - dt.timedelta(minutes=rng.choice((30, 60, 120, 240)))
        sent = remind_at < now
        rows.append(
            {
                "id": reminder_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "target_table": target_table,
                "target_row_id": target_row_id,
                "user_id": author,
                "remind_at": remind_at,
                "channel": rng.choice(("push", "push", "whatsapp")),
                "message": f"Recordatorio: {title}",
                "url": f"/admin/{'calendar' if target_table == 'events' else 'tasks'}",
                "status": "SENT" if sent else "PENDING",
                "sent_at": remind_at if sent else None,
                "error": None,
                "source": "manual",
                "created_by": author,
                "created_at": remind_at - dt.timedelta(days=1),
                "updated_at": now,
            }
        )
    return rows


def _build_notes(
    rng: Random,
    now: dt.datetime,
    author: str | None,
    people: list[GeneratedPerson],
    properties: list[GeneratedProperty],
    opportunities: list[GeneratedOpportunity],
    event_rows: list[dict],
    count: int,
) -> list[dict]:
    rows: list[dict] = []
    for index in range(count):
        target = _weighted(rng, (("contacts", 40), ("properties", 25), ("opportunities", 25), ("events", 10)))
        if target == "contacts":
            target_row_id = rng.choice(people).id
        elif target == "properties":
            target_row_id = rng.choice(properties).id
        elif target == "opportunities":
            target_row_id = rng.choice(opportunities).id
        else:
            target_row_id = rng.choice(event_rows)["id"]
        created_at = _business_time(rng, _weekday_biased_day(rng, now, 300, 0))
        rows.append(
            {
                "id": note_id(index),
                "tenant_id": DEMO_TENANT_ID,
                "body": rng.choice(NOTE_TEMPLATES),
                "target_table": target,
                "target_row_id": target_row_id,
                "source": rng.choice(("manual", "manual", "manual", "agent")),
                "created_by": author,
                "created_at": min(created_at, now),
                "updated_at": min(created_at, now),
            }
        )
    return rows


def _build_tags_and_taggings(
    rng: Random,
    author: str | None,
    people: list[GeneratedPerson],
    properties: list[GeneratedProperty],
    opportunities: list[GeneratedOpportunity],
    tagging_count: int,
) -> tuple[list[dict], list[dict]]:
    tag_rows = [
        {"id": tag_id(name), "tenant_id": DEMO_TENANT_ID, "name": name, "color": color} for name, color in TAG_SPECS
    ]

    taggings: dict[str, dict] = {}
    while len(taggings) < tagging_count:
        name, _ = rng.choice(TAG_SPECS)
        target = _weighted(rng, (("contacts", 50), ("properties", 30), ("opportunities", 20)))
        if target == "contacts":
            target_row_id = rng.choice(people).id
        elif target == "properties":
            target_row_id = rng.choice(properties).id
        else:
            target_row_id = rng.choice(opportunities).id
        key = f"{name}-{target}-{target_row_id}"
        taggings[key] = {
            "id": tagging_id(name, target, target_row_id),
            "tenant_id": DEMO_TENANT_ID,
            "tag_id": tag_id(name),
            "target_table": target,
            "target_row_id": target_row_id,
            "created_by": author,
        }

    return tag_rows, list(taggings.values())


# --------------------------------------------------------------------------------------
# Plan assembly
# --------------------------------------------------------------------------------------


def build_plan(
    rng_seed: int = 20260819,
    *,
    admin_profile_ids: list[str] | None = None,
    admin_memberships: list[dict[str, Any]] | None = None,
    now: dt.datetime | None = None,
    people_count: int = 250,
    property_count: int = 40,
    opportunity_count: int = 120,
    loose_interaction_count: int = 330,
    task_count: int = 300,
    note_count: int = 120,
    reminder_count: int = 150,
    tagging_count: int = 260,
) -> SeedPlan:
    """Build every row dict without touching the database.

    ``admin_profile_ids`` must be real ``auth.users`` ids — ``created_by`` and
    ``owner_user`` are FKs into that table. Pass ``None`` and those columns stay NULL
    (and ``reminders``, whose ``user_id`` is NOT NULL, is skipped entirely).
    """
    rng = Random(rng_seed)
    now = now or dt.datetime.now(tz=TZ)
    admin_profile_ids = admin_profile_ids or []
    author = admin_profile_ids[0] if admin_profile_ids else None

    plan = SeedPlan()
    plan.profile_ids = list(admin_profile_ids)

    plan.add(
        "tenants",
        [
            {
                "id": DEMO_TENANT_ID,
                "name": DEMO_TENANT_NAME,
                "slug": DEMO_TENANT_SLUG,
                "is_active": True,
                "settings": {"ai_assistant_name": "Propo", "seed": "demo"},
                "privacy_policy_version": "1.0",
                "privacy_contact_email": "privacidad@propos.dev",
            }
        ],
    )
    plan.add("tenant_memberships", list(admin_memberships or []))

    organization_rows = _build_organizations(rng, now, author)
    plan.add("organizations", organization_rows)
    plan.organization_ids = [row["id"] for row in organization_rows]

    place_rows, property_rows, properties = _build_places_and_properties(
        rng, now, author, organization_rows, property_count
    )
    people_rows, people = _build_people(rng, now, author, people_count)
    _link_people_to_organizations(rng, people_rows, organization_rows)
    plan.add("contacts", people_rows)
    plan.person_ids = [row["id"] for row in people_rows]

    plan.add("places", place_rows)

    project_rows, project_link_rows = _build_projects(rng, now, author, place_rows, properties, property_rows)
    plan.add("projects", project_rows)
    plan.project_ids = [row["id"] for row in project_rows]

    plan.add("properties", property_rows)
    plan.property_ids = [row["id"] for row in property_rows]
    plan.add("project_properties", project_link_rows)

    plan.add("pipelines", _build_pipelines())

    opportunity_rows, history_rows, opportunities = _build_opportunities(
        rng, now, author, people, properties, opportunity_count
    )
    plan.add("opportunities", opportunity_rows)
    plan.opportunity_ids = [row["id"] for row in opportunity_rows]
    plan.add("opportunity_stage_history", history_rows)

    interaction_rows, participant_rows, target_rows, visits = _build_interactions(
        rng, now, author, people, properties, opportunities, loose_interaction_count
    )
    plan.add("interactions", interaction_rows)
    plan.interaction_ids = [row["id"] for row in interaction_rows]
    plan.add("interaction_participants", participant_rows)
    plan.add("interaction_targets", target_rows)

    event_rows, task_rows = _build_events_and_tasks(rng, now, author, people, properties, visits, task_count)
    plan.add("tasks", task_rows)
    plan.add("events", event_rows)
    plan.add("reminders", _build_reminders(rng, now, author, event_rows, task_rows, reminder_count))

    plan.add(
        "notes",
        _build_notes(rng, now, author, people, properties, opportunities, event_rows, note_count),
    )

    tag_rows, tagging_rows = _build_tags_and_taggings(rng, author, people, properties, opportunities, tagging_count)
    plan.add("tags", tag_rows)
    plan.add("taggings", tagging_rows)

    return plan


# --------------------------------------------------------------------------------------
# Database side
# --------------------------------------------------------------------------------------


def ensure_demo_tenant_slug(conn: Any) -> None:
    """Fail early and clearly if the `propos-demo` enum label is missing.

    ``tenants.slug`` is an enum (labels ``anaida``/``ceter``), so the demo
    workspace cannot be inserted until the label exists. Adding it belongs to a
    migration, not here: an enum label is permanent — the wipe removes rows,
    never types — and Postgres refuses to use a label added in the same
    transaction that inserts with it.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
            "WHERE t.typname = 'tenant_slug' AND e.enumlabel = %s",
            (DEMO_TENANT_SLUG,),
        )
        if cur.fetchone() is None:
            raise SeedAbortError(
                f"tenant_slug has no '{DEMO_TENANT_SLUG}' label — run `make migrate` first "
                "(supabase/migrations/20240601000055_demo_tenant_slug.sql)"
            )


def lookup_admin_profiles(conn: Any) -> list[dict[str, Any]]:
    """Existing admin profiles that should get access to the demo workspace."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email FROM public.profiles WHERE lower(email) = ANY(%s)",
            ([email.lower() for email in DEMO_ADMIN_EMAILS],),
        )
        # context.connect() uses dict_row, so a row is a mapping, not a tuple.
        return [{"id": str(row["id"]), "email": row["email"]} for row in cur.fetchall()]


def _membership_rows(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "user_id": profile["id"],
            "tenant_id": DEMO_TENANT_ID,
            "role": "ADMIN",
            "admin_scope": [],
            "is_dev_admin": profile["email"].lower() == "vicenteaguero@uc.cl",
            "view": "admin-dev" if profile["email"].lower() == "vicenteaguero@uc.cl" else "admin",
            "is_active": True,
        }
        for profile in profiles
    ]


JSONB_COLUMNS: dict[str, tuple[str, ...]] = {
    "tenants": ("settings",),
    "contacts": ("metadata",),
    "organizations": ("metadata",),
    "places": ("metadata",),
    "projects": ("metadata",),
    "properties": ("metadata",),
    "opportunities": ("metadata",),
    "interactions": ("audience_caps",),
    "tasks": ("related",),
}

# Tables whose uniqueness is not the `id` column, for insert_many's ON CONFLICT target.
CONFLICT_TARGETS: dict[str, str] = {"tenant_memberships": "user_id, tenant_id"}


def _adapt_jsonb(table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Wrap jsonb values in ``Jsonb``; psycopg3 cannot adapt a bare ``dict``."""
    columns = JSONB_COLUMNS.get(table)
    if not columns:
        return list(rows)
    return [
        {key: Jsonb(value) if key in columns and isinstance(value, dict) else value for key, value in row.items()}
        for row in rows
    ]


def seed_core(conn: Any, state: SeedContext, rng_seed: int = 20260819) -> SeedContext:
    """Write the relational core of the demo workspace and record it on ``state``."""
    assert_safe_to_write(DEMO_TENANT_ID)
    ensure_demo_tenant_slug(conn)

    profiles = lookup_admin_profiles(conn)
    if not profiles:
        print("WARN no demo admin profiles found — created_by/owner_user stay NULL, reminders skipped")

    plan = build_plan(
        rng_seed,
        admin_profile_ids=[profile["id"] for profile in profiles],
        admin_memberships=_membership_rows(profiles),
    )

    for table, rows in plan.tables:
        if not rows:
            continue
        insert_many(conn, table, _adapt_jsonb(table, rows), conflict=CONFLICT_TARGETS.get(table, "id"))
        state.record(table, len(rows))

    state.person_ids = plan.person_ids
    # ``people`` is a view over ``contacts``, so these are contact ids. media.py FKs
    # (client_conversations, client_consents, document_assignments) point at
    # ``contacts(id)``, hence the alias.
    state.contact_ids = plan.person_ids
    state.property_ids = plan.property_ids
    state.organization_ids = plan.organization_ids
    state.project_ids = plan.project_ids
    state.opportunity_ids = plan.opportunity_ids
    state.interaction_ids = plan.interaction_ids
    state.profile_ids = plan.profile_ids

    return state
