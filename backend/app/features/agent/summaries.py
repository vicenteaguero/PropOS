"""The sentence a reviewer reads on a proposal card.

`summary_es` was a template: the classifier's optional one-line `summary` when
it emitted one, otherwise a hard-coded f-string per intent — "crear contacto
Juan", "actualizar contacto", or just a task's title. So the Pendientes queue
led with WHAT KIND of action was proposed and almost never with what it would
actually do, or to whom. A broker reading "Actualizar persona" has to open the
card to learn anything at all.

This builds the sentence deterministically from what the resolver already
worked out, so a model that returns nothing useful still produces
"Crear tarea para Catalina Rojas — Responder sobre el crédito hipotecario".
The classifier's `summary` becomes the DETAIL clause, never the whole line: the
verb and the subject are ours.

One function, because the chat reply (`chat.py`) and the card render the same
string and must not drift.
"""

from __future__ import annotations

from typing import Any

from app.features.agent.resolver import FieldResolution, ResolvedFields

#: Minimum length for the classifier's clause to be worth appending. "tarea"
#: and "actualizar contacto" are labels, not details.
_MIN_DETAIL = 12

#: The handful of enum labels this sentence needs, in Spanish.
#:
#: Spanish labels live on the frontend (`shared/lib/labels.ts`) and there is no
#: backend registry to import — but this string is composed server-side and read
#: by a human, so the words have to exist here. Kept deliberately small: only
#: the enums that appear in a sentence. `test_summary_es.py` pins these against
#: the frontend registry so the two cannot drift silently.
_ES: dict[str, dict[str, str]] = {
    "eventKind": {
        "VISIT": "Visita",
        "MEETING": "Reunión",
        "CALL": "Llamada",
        "SIGNING": "Firma",
        "TODO": "Pendiente",
        "OTHER": "Otro",
    },
    "interactionKind": {
        "VISIT": "Visita",
        "CALL": "Llamada",
        "EMAIL": "Correo",
        "WHATSAPP_LOG": "WhatsApp",
        "NOTE": "Nota",
        "MEETING": "Reunión",
        "SHOWING": "Muestra",
        "OTHER": "Otro",
    },
    "contactType": {
        "BUYER": "Comprador",
        "SELLER": "Vendedor",
        "LANDOWNER": "Propietario",
        "NOTARY": "Notaría",
        "INVESTOR": "Inversionista",
        "EMPLOYEE": "Empleado",
        "FAMILY": "Familia",
        "VENDOR": "Proveedor",
        "STAKEHOLDER": "Interesado",
        "OTHER": "Otro",
    },
    "txCategory": {
        "COMMISSION": "Comisión",
        "SALE_PROCEEDS": "Venta",
        "RENT": "Arriendo",
        "AD_SPEND": "Publicidad",
        "MARKETING": "Marketing",
        "NOTARY_FEE": "Notaría",
        "TAX": "Impuestos",
        "UTILITY": "Servicios",
        "SALARY": "Sueldos",
        "SOFTWARE": "Software",
        "REIMBURSEMENT": "Reembolso",
        "DEPOSIT": "Depósito",
        "REFUND": "Devolución",
        "TRANSFER": "Transferencia",
        "OTHER": "Otro",
    },
}


def label_es(kind: str, value: Any) -> str | None:
    """The Spanish word for an enum value, or None when there is no mapping."""
    if not isinstance(value, str):
        return None
    return _ES.get(kind, {}).get(value.upper())


#: Field name → how to say it in Spanish, for "Actualizar X: teléfono, correo".
_FIELD_ES = {
    "phone": "teléfono",
    "email": "correo",
    "rut": "RUT",
    "notes": "notas",
    "kind": "tipo",
    "address": "dirección",
    "comuna": "comuna",
    "price_clp": "precio",
}


def _entity_name(fr: FieldResolution | None) -> str | None:
    """The canonical name when the resolver matched one, else what was said.

    A match is worth preferring: the broker said "la Catalina", the database
    says "Catalina Rojas", and the card is read against the database.
    """
    if fr is None:
        return None
    if fr.candidates:
        return fr.candidates[0].label
    return fr.raw or None


def _detail(payload: dict[str, Any], obj: str) -> str | None:
    """The classifier's clause, if it adds anything the object phrase does not."""
    raw = payload.get("summary")
    if not isinstance(raw, str):
        return None
    text = raw.strip().rstrip(".")
    if len(text) < _MIN_DETAIL:
        return None
    if text.lower() in obj.lower():
        return None
    return text[0].upper() + text[1:]


def _join(head: str, detail: str | None) -> str:
    return f"{head} — {detail}" if detail else head


def _changed_fields(payload: dict[str, Any]) -> str:
    """ "teléfono y correo" — what an update actually touches."""
    skip = {"id", "full_name", "summary", "summary_es", "kind"}
    names = [_FIELD_ES.get(k, k) for k in payload if k not in skip and payload.get(k) not in (None, "")]
    if not names:
        return "datos"
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + f" y {names[-1]}"


def build_summary_es(intent: str, payload: dict[str, Any], resolved: ResolvedFields | None) -> str:
    """One Spanish sentence: what will happen, and to whom."""
    person = _entity_name(resolved.person if resolved else None)
    prop = _entity_name(resolved.property if resolved else None)

    def about() -> str:
        if person and prop:
            return f" para {person} sobre {prop}"
        if person:
            return f" para {person}"
        if prop:
            return f" sobre {prop}"
        return ""

    if intent == "create_task":
        head = f"Crear tarea{about()}"
        title = str(payload.get("title") or "").strip()
        return _join(head, _detail(payload, head) or (title or None))

    if intent == "create_event":
        kind = label_es("eventKind", payload.get("kind")) or "evento"
        who = f" con {person}" if person else ""
        where = f" en {prop}" if prop else ""
        return _join(f"Agendar {kind.lower()}{who}{where}", _detail(payload, kind))

    if intent == "log_interaction":
        kind = label_es("interactionKind", payload.get("kind")) or "interacción"
        who = f" con {person}" if person else ""
        head = f"Registrar {kind.lower()}{who}"
        return _join(head, _detail(payload, head))

    if intent == "create_person":
        name = str(payload.get("full_name") or person or "").strip() or "contacto"
        kind = label_es("contactType", payload.get("kind"))
        suffix = f" ({kind.lower()})" if kind else ""
        return f"Crear contacto {name}{suffix}"

    if intent == "update_person":
        name = str(payload.get("full_name") or person or "").strip() or "el contacto"
        detail = _detail(payload, name)
        return f"Actualizar {name}: {detail or _changed_fields(payload)}"

    if intent == "add_note":
        body = str(payload.get("body") or "").strip()
        head = f"Agregar nota{about()}"
        return _join(head, body[:100] or None)

    if intent == "create_property":
        title = str(payload.get("title") or "").strip() or "propiedad"
        comuna = str(payload.get("comuna") or "").strip()
        return f"Crear propiedad {title}" + (f" en {comuna}" if comuna else "")

    if intent == "attach_photos_to_property":
        n = len(payload.get("media_message_ids") or [])
        photos = f"{n} foto{'s' if n != 1 else ''}" if n else "fotos"
        return f"Adjuntar {photos} a {prop or payload.get('title') or 'la propiedad'}"

    if intent == "create_document_from_photos":
        title = str(payload.get("title") or "documento").strip()
        return f'Crear documento "{title}" con fotos'

    if intent == "log_transaction":
        direction = "Registrar ingreso" if payload.get("direction") == "IN" else "Registrar egreso"
        amount = payload.get("amount")
        money = f" de {_clp(amount)}" if amount else ""
        category = label_es("txCategory", payload.get("category"))
        because = f" por {category.lower()}" if category else ""
        return f"{direction}{money}{because}"

    if intent == "create_organization":
        return f"Crear organización {payload.get('name') or '?'}"

    if intent == "create_campaign":
        name = payload.get("name") or "?"
        channel = payload.get("channel")
        return f"Crear campaña {name}" + (f" en {channel}" if channel else "")

    # An intent nobody has written a sentence for still gets its subject named,
    # which beats the bare action label the card used to fall back to.
    return _join(intent.replace("_", " ").capitalize() + about(), _detail(payload, intent))


def _clp(amount: Any) -> str:
    try:
        return "$" + f"{int(float(amount)):,}".replace(",", ".")
    except (TypeError, ValueError):
        return str(amount)
