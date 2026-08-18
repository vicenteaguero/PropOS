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

PROPERTY_ALIASES = {
    "titulo": "title",
    "título": "title",
    "title": "title",
    "nombre": "title",
    "publicacion": "title",
    "publicación": "title",
    "direccion": "address",
    "dirección": "address",
    "address": "address",
    "calle": "address",
    "ubicacion": "address",
    "ubicación": "address",
    "comuna": "comuna",
    "ciudad": "ciudad",
    "region": "region",
    "región": "region",
    "rol": "rol",
    "tipo": "property_type",
    "tipo de propiedad": "property_type",
    "tipo_propiedad": "property_type",
    "property_type": "property_type",
    "operacion": "listing_kind",
    "operación": "listing_kind",
    "tipo de operacion": "listing_kind",
    "tipo de operación": "listing_kind",
    "listing_kind": "listing_kind",
    "estado": "status",
    "status": "status",
    "dormitorios": "bedrooms",
    "habitaciones": "bedrooms",
    "piezas": "bedrooms",
    "bedrooms": "bedrooms",
    "banos": "bathrooms",
    "baños": "bathrooms",
    "bathrooms": "bathrooms",
    "superficie": "area_sqm",
    "superficie util": "area_sqm",
    "superficie útil": "area_sqm",
    "superficie construida": "area_sqm",
    "metros": "area_sqm",
    "m2": "area_sqm",
    "area_sqm": "area_sqm",
    "terreno": "lot_sqm",
    "superficie terreno": "lot_sqm",
    "m2 terreno": "lot_sqm",
    "lot_sqm": "lot_sqm",
    "precio": "list_price_cents",
    "valor": "list_price_cents",
    "price": "list_price_cents",
    "list_price_cents": "list_price_cents",
    "moneda": "currency",
    "currency": "currency",
    "descripcion": "description",
    "descripción": "description",
    "description": "description",
    "observaciones": "description",
    "ano de construccion": "year_built",
    "año de construcción": "year_built",
    "año construccion": "year_built",
    "año construcción": "year_built",
    "year_built": "year_built",
    "estacionamientos": "parking_count",
    "bodega": "has_storage",
    "orientacion": "orientation",
    "orientación": "orientation",
    "propietario": "owner_name",
    "dueno": "owner_name",
    "dueño": "owner_name",
    "latitud": "lat",
    "lat": "lat",
    "longitud": "lng",
    "lng": "lng",
}

# Fields a Chilean listing sheet carries that `properties` has no column for:
# they ride along in the JSONB metadata instead of being dropped.
PROPERTY_METADATA_FIELDS = (
    "comuna",
    "ciudad",
    "region",
    "rol",
    "property_type",
    "parking_count",
    "has_storage",
    "orientation",
    "owner_name",
)

PROPERTY_STATUS_VALUES = {
    "disponible": "AVAILABLE",
    "activa": "AVAILABLE",
    "activo": "AVAILABLE",
    "publicada": "AVAILABLE",
    "reservada": "RESERVED",
    "reservado": "RESERVED",
    "vendida": "SOLD",
    "vendido": "SOLD",
    "arrendada": "RESERVED",
    "arrendado": "RESERVED",
    "inactiva": "INACTIVE",
    "inactivo": "INACTIVE",
    "pausada": "INACTIVE",
}

PROPERTY_LISTING_KIND_VALUES = {
    "venta": "SALE",
    "vende": "SALE",
    "sale": "SALE",
    "arriendo": "RENT",
    "arrienda": "RENT",
    "renta": "RENT",
    "rent": "RENT",
    "leasing": "LEASE",
    "lease": "LEASE",
    "arriendo con opcion de compra": "LEASE",
}

_TRUTHY = {"si", "sí", "s", "yes", "y", "true", "1", "x"}

ALIASES = {
    "contacts": CONTACT_ALIASES,
    "transactions": TRANSACTION_ALIASES,
    "properties": PROPERTY_ALIASES,
}


def map_header(entity: str, header: str) -> str | None:
    return ALIASES.get(entity, {}).get(header.strip().lower())


def _to_number(raw: object) -> float | None:
    """Parse a Chilean-formatted number: '1.500.000', '120,5', '$ 90.000.000'."""
    text = str(raw or "").strip()
    text = "".join(ch for ch in text if ch.isdigit() or ch in ".,-")
    if not text:
        return None
    if "," in text:
        # Comma is the decimal mark here, so dots are thousand separators.
        text = text.replace(".", "").replace(",", ".")
    elif "." in text:
        # A lone dot is a thousand separator when it splits a 3-digit group.
        head, _, tail = text.rpartition(".")
        text = head.replace(".", "") + tail if len(tail) == 3 else text
    try:
        return float(text)
    except ValueError:
        return None


def _to_int(raw: object) -> int | None:
    value = _to_number(raw)
    return int(value) if value is not None else None


def _coerce_property(out: dict) -> dict:
    """Type the property row and park the extra Chilean columns in metadata."""
    for field in ("bedrooms", "bathrooms", "year_built", "parking_count"):
        if field in out:
            out[field] = _to_int(out[field])
    for field in ("area_sqm", "lot_sqm", "lat", "lng"):
        if field in out:
            out[field] = _to_number(out[field])
    if "list_price_cents" in out:
        # Sheets carry whole pesos (or whole UF); the column is minor units.
        pesos = _to_number(out["list_price_cents"])
        out["list_price_cents"] = int(round(pesos * 100)) if pesos is not None else None
    if out.get("currency"):
        out["currency"] = str(out["currency"]).strip().upper()
    if out.get("status"):
        raw = str(out["status"]).strip()
        out["status"] = PROPERTY_STATUS_VALUES.get(raw.lower(), raw.upper())
    if out.get("listing_kind"):
        raw = str(out["listing_kind"]).strip()
        out["listing_kind"] = PROPERTY_LISTING_KIND_VALUES.get(raw.lower(), raw.upper())
    if "has_storage" in out:
        out["has_storage"] = str(out["has_storage"] or "").strip().lower() in _TRUTHY
    if not out.get("title") and out.get("address"):
        # Broker sheets often have no title column; the address is the listing.
        out["title"] = str(out["address"]).strip()

    metadata = dict(out.get("metadata") or {})
    for field in PROPERTY_METADATA_FIELDS:
        if field not in out:
            continue
        value = out.pop(field)
        if value not in (None, ""):
            metadata[field] = value
    if metadata:
        out["metadata"] = metadata
    # Drop blanks so the schema defaults apply: an empty cell must not reach an
    # enum field as "" and fail the whole row.
    return {k: v for k, v in out.items() if v is not None and v != ""}


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
    if entity == "properties":
        return _coerce_property(out)
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
