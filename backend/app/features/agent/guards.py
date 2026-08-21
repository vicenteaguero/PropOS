"""The rules Propo cannot talk its way past.

A prompt is a suggestion. These are the same rules expressed where the model
has no vote — which matters, because every one of them protects somebody who is
not in the room when the assistant decides to send a message.

Consent and the 24 h window are not reimplemented here: they already have one
implementation in `notifications.whatsapp.dispatcher`, and a second copy of an
authorization rule is how the two drift apart. This module is where the AI's
decision to act is checked, and it delegates the lookups.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client
from app.features.notifications.whatsapp.dispatcher import has_consent, within_freeform_window

logger = get_logger("AGENT_GUARD")


class GuardError(RuntimeError):
    """A rule refused the action. The message is shown to the broker, in Spanish."""


def assert_consent(tenant_id: UUID | str, contact_id: str | None) -> None:
    """No outbound to somebody who has not opted in, or who opted out."""
    if not contact_id:
        raise GuardError("No se puede escribir: la conversación no está identificada.")
    if not has_consent(str(tenant_id), contact_id):
        raise GuardError("Esta persona no tiene consentimiento vigente para WhatsApp.")


def assert_within_window(conversation_id: str) -> None:
    """Outside 24 h only an approved template can be sent, so free text is a lie."""
    if not within_freeform_window(conversation_id):
        raise GuardError("La ventana de 24 h está cerrada: hay que usar una plantilla aprobada.")


def assert_not_first_contact(tenant_id: UUID | str, contact_id: str) -> None:
    """The AI never opens a relationship.

    A first message is the one with no prior inbound to reply to — the moment a
    person meets the brokerage. Getting that wrong is not a data error, it is a
    stranger receiving an automated message they never asked for.
    """
    rows = (
        get_supabase_client()
        .table("client_conversations")
        .select("last_inbound_at")
        .eq("tenant_id", str(tenant_id))
        .eq("contact_id", contact_id)
        .not_.is_("last_inbound_at", "null")
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise GuardError("El primer mensaje a un contacto nuevo lo tiene que aprobar una persona.")


#: Fields nobody may state as fact without a source. Money and surface are the
#: two a buyer makes a decision on.
_MUST_BE_VERIFIED = ("list_price_cents", "area_sqm", "lot_sqm", "rol")


def assert_no_unverified_quote(property_row: dict, fields: tuple[str, ...] = _MUST_BE_VERIFIED) -> None:
    """Do not let the assistant assert a number nobody checked.

    Not a refusal to mention it — the correct output is "el propietario declara
    120 m², sin certificar". This raises so the caller words it that way instead
    of stating it flat.
    """
    provenance = property_row.get("provenance") or {}
    for field in fields:
        if property_row.get(field) is None:
            continue
        source = (provenance.get(field) or {}).get("src")
        if source != "verified":
            raise GuardError(
                f"«{field}» no está verificado ({source or 'origen desconocido'}): "
                "hay que decir que es declarado, no afirmarlo."
            )


#: "el martes", "mañana a las 5", "el 12 de marzo" — a commitment about when.
_DATE_PROMISE = re.compile(
    r"\b(mañana|pasado mañana|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|"
    r"sábado|sabado|domingo|el \d{1,2} de \w+|\d{1,2}/\d{1,2})\b",
    re.IGNORECASE,
)
_COMMITMENT = re.compile(
    r"\b(te (lo )?(env[ií]o|mando|confirmo|aviso)|queda(mos)? (para|el)|"
    r"lo tengo listo|estar[áa] listo|te espero)\b",
    re.IGNORECASE,
)


def assert_no_date_commitment(text: str) -> None:
    """The assistant does not promise a date on the brokerage's behalf.

    It can propose one and let a human confirm; what it cannot do is tell a
    client "te lo envío el martes" when nobody has agreed to that.
    """
    if _DATE_PROMISE.search(text or "") and _COMMITMENT.search(text or ""):
        raise GuardError("El mensaje compromete una fecha; eso lo confirma una persona.")


def assert_not_quiet_hours(contact: dict, now: datetime | None = None) -> None:
    """Respect the hours the person asked not to be contacted in."""
    quiet = contact.get("quiet_hours") or {}
    start, end = quiet.get("from"), quiet.get("to")
    if not start or not end:
        return
    current = (now or datetime.now(UTC)).strftime("%H:%M")
    # A window that wraps midnight (21:00 → 09:00) is the normal case.
    inside = start <= current < end if start < end else (current >= start or current < end)
    if inside:
        raise GuardError(f"Está en su horario de no molestar ({start}–{end}).")
