"""CSV header alias maps + row coercion per importable entity.

Spanish/English header aliases → canonical column names. ``coerce`` turns a
raw CSV row into the dict the domain table expects (typing amounts, etc.).
"""

from __future__ import annotations

from app.core.rut import parse_rut

CONTACT_ALIASES = {
    "nombre": "full_name",
    "name": "full_name",
    "full_name": "full_name",
    "email": "email",
    "correo": "email",
    "telefono": "phone",
    "teléfono": "phone",
    "phone": "phone",
    "rut": "rut",
    "tipo": "type",
    "type": "type",
    "direccion": "address",
    "dirección": "address",
    "address": "address",
    "notas": "notes",
    "notes": "notes",
}

TRANSACTION_ALIASES = {
    "direccion": "direction",
    "dirección": "direction",
    "direction": "direction",
    "tipo": "direction",
    "categoria": "category",
    "categoría": "category",
    "category": "category",
    "monto": "amount_cents",
    "amount": "amount_cents",
    "amount_clp": "amount_cents",
    "fecha": "occurred_at",
    "date": "occurred_at",
    "occurred_at": "occurred_at",
    "descripcion": "description",
    "descripción": "description",
    "description": "description",
}

ALIASES = {"contacts": CONTACT_ALIASES, "transactions": TRANSACTION_ALIASES}


def map_header(entity: str, header: str) -> str | None:
    return ALIASES.get(entity, {}).get(header.strip().lower())


def coerce_row(entity: str, row: dict) -> dict:
    """Type-coerce a mapped row for the target table."""
    out = dict(row)
    if entity == "transactions":
        if "amount_cents" in out and out["amount_cents"] not in (None, ""):
            # Accept "1.500.000" or "1500000" → integer pesos → cents.
            digits = str(out["amount_cents"]).replace(".", "").replace(",", "").replace("$", "").strip()
            out["amount_cents"] = int(digits) * 100 if digits.isdigit() else None
        if out.get("direction"):
            out["direction"] = str(out["direction"]).strip().upper()
        if out.get("category"):
            out["category"] = str(out["category"]).strip().upper()
    if entity == "contacts":
        if out.get("type"):
            out["type"] = str(out["type"]).strip().upper()
        if "rut" in out:
            # Canonicalize here, not just in the validator: `commit` inserts the
            # staged row, so a dotted "20.442.436-5" would reach the table raw.
            # A bad RUT is left as-is so the schema validator rejects that one
            # row with a message instead of failing the whole file.
            raw_rut = str(out["rut"] or "").strip()
            try:
                out["rut"] = parse_rut(raw_rut) if raw_rut else None
            except ValueError:
                out["rut"] = raw_rut
    return out
