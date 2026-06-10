"""Portal lead-email classifiers + extractors.

Promoted from backend/scripts/test_unne_email_parsing.py (the UNNE Titan
mailbox analysis). Given a message's subject/body/from, ``classify_email``
returns a ``ParsedLead`` when the email is a portal lead notification, else
None. Regexes are covered by tests/features/email_sync/test_parsers.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

LEAD_SUBJECT_PATTERNS = {
    "Yapo": re.compile(
        r"alguien est[aá] interesado|te han contactado|"
        r"interesado en (?:el )?anuncio|"
        r"yapo\.cl\s*-\s*(?:interesado|consulta reenviada)",
        re.I,
    ),
    "TocToc": re.compile(r"solicitud de contacto a la propiedad", re.I),
    "Portal Inmobiliario": re.compile(r"recibiste un contacto", re.I),
    "MercadoLibre": re.compile(r"te contactaron en", re.I),
    "Proppit": re.compile(r"nueva solicitud|nueva consulta", re.I),
    "Chile Propiedades": re.compile(r"contacto en chilepropiedades", re.I),
    "Doomos": re.compile(r"has recibido una pregunta", re.I),
    "Enlace Inmobiliario": re.compile(r"notificaciones de acci[oó]n", re.I),
}

CUSTOMER_REPLY_SUBJ = re.compile(r"^\s*re:\s+", re.I)

ENLACE_ACTIONS = [
    "Consulta Corredora",
    "Consulta Whatsapp",
    "Visita a la Ficha",
    "Ver datos Corredora",
    "Quiero que me Contacten",
    "Solicitud de PreAprobación Enviada",
    "Solicitud de PreAprobación Respondida",
    "Solicitud de PreAprobación Inconclusa",
    "Simulación Dividendo",
]
ACTIVE_ACTIONS = {
    "Consulta Corredora",
    "Consulta Whatsapp",
    "Ver datos Corredora",
    "Quiero que me Contacten",
}
MORTGAGE_ACTIONS = {
    "Solicitud de PreAprobación Enviada",
    "Solicitud de PreAprobación Respondida",
    "Solicitud de PreAprobación Inconclusa",
    "Simulación Dividendo",
}
_action_pat = "|".join(re.escape(a) for a in ENLACE_ACTIONS)
ACTION_ROW_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})"
    rf"({_action_pat})"
    r"(\d+)([A-ZÁÉÍÓÚÑa-záéíóúñ ]+?)(?:Enlace|Banco|Marketplace|Simulador|Hipotecario)",
    re.I,
)

PROPPIT_TEMPLATE_B = re.compile(
    r"Propiedad de inter[eé]s\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,0-9]+?)\s+(\d{4,5})\s+(?:\$|UF|\d)",
    re.I,
)
PROPPIT_OLD_REF = re.compile(r"Ref\.\s*(\d{9})", re.I)

YAPO_ID_EXTERNO_RE = re.compile(r"ID\s+Externo:?\s*(\d{3,5})", re.I)
TOCTOC_BODY_CODE_RE = re.compile(r"C[oó]digo de propiedad:?\s*(\d+)", re.I)
TOCTOC_SUBJ_RE = re.compile(r"propiedad\s+(\d+)", re.I)
ENLACE_HEADER_NR_RE = re.compile(r"producto\s+(\d+)", re.I)
CP_EXT_RE = re.compile(r"C[oó]digo\s+Externo\s+(\d+)", re.I)
CP_EXT_SUBJ_RE = re.compile(r"ID externo:?\s*(\d+)", re.I)
DOOMOS_SLUG_RE = re.compile(r"doomos\.cl/[^/]+/(\d+)_", re.I)


def normalize_phone(raw: str | None) -> str | None:
    """Chilean mobile → last 8 digits (drops +56 / leading 9)."""
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None
    if digits.startswith("56") and len(digits) > 9:
        digits = digits[2:]
    return digits[-8:] if len(digits) >= 8 else digits


@dataclass
class ParsedLead:
    portal: str
    property_external_id: str | None = None
    contact_name: str | None = None
    contact_phone: str | None = None


def detect_portal(subject: str) -> str | None:
    for portal, pattern in LEAD_SUBJECT_PATTERNS.items():
        if pattern.search(subject or ""):
            return portal
    return None


def is_customer_reply(subject: str) -> bool:
    return bool(CUSTOMER_REPLY_SUBJ.search(subject or ""))


def _extract_external_id(portal: str, subject: str, body: str) -> str | None:
    text = f"{subject}\n{body}"
    if portal == "Yapo":
        m = YAPO_ID_EXTERNO_RE.search(text)
        return m.group(1) if m else None
    if portal == "TocToc":
        m = TOCTOC_BODY_CODE_RE.search(body) or TOCTOC_SUBJ_RE.search(subject)
        return m.group(1) if m else None
    if portal == "Proppit":
        m = PROPPIT_TEMPLATE_B.search(body)
        if m:
            return m.group(2)
        m = PROPPIT_OLD_REF.search(body)
        return m.group(1) if m else None
    if portal == "Chile Propiedades":
        m = CP_EXT_RE.search(body) or CP_EXT_SUBJ_RE.search(subject)
        return m.group(1) if m else None
    if portal == "Doomos":
        m = DOOMOS_SLUG_RE.search(body)
        return m.group(1) if m else None
    if portal == "Enlace Inmobiliario":
        m = ACTION_ROW_RE.search(body) or ENLACE_HEADER_NR_RE.search(body)
        return (m.group(4) if m and m.re is ACTION_ROW_RE else m.group(1)) if m else None
    return None


def classify_email(subject: str, body: str, from_email: str | None = None) -> ParsedLead | None:
    """Return a ParsedLead if the email is a portal lead notification, else None."""
    portal = detect_portal(subject or "")
    if not portal:
        return None
    return ParsedLead(
        portal=portal,
        property_external_id=_extract_external_id(portal, subject or "", body or ""),
    )
