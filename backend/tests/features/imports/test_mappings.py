"""CSV header mapping + row coercion."""

from app.features.imports.mappings import coerce_row, map_header


def test_contact_header_aliases_es_en():
    assert map_header("contacts", "Nombre") == "full_name"
    assert map_header("contacts", "correo") == "email"
    assert map_header("contacts", "Teléfono") == "phone"
    assert map_header("contacts", "unknown") is None


def test_transaction_header_aliases():
    assert map_header("transactions", "Monto") == "amount_cents"
    assert map_header("transactions", "categoría") == "category"
    assert map_header("transactions", "fecha") == "occurred_at"


def test_coerce_transaction_amount_pesos_to_cents():
    out = coerce_row("transactions", {"amount_cents": "1.500.000", "direction": "in", "category": "rent"})
    assert out["amount_cents"] == 1_500_000_00
    assert out["direction"] == "IN"
    assert out["category"] == "RENT"


def test_coerce_transaction_invalid_amount():
    out = coerce_row("transactions", {"amount_cents": "abc"})
    assert out["amount_cents"] is None


def test_coerce_contact_type_upper():
    out = coerce_row("contacts", {"type": "buyer"})
    assert out["type"] == "BUYER"


def test_coerce_contact_rut_canonicalized():
    out = coerce_row("contacts", {"rut": "20.442.436-5"})
    assert out["rut"] == "20442436-5"


def test_coerce_contact_rut_blank_becomes_none():
    assert coerce_row("contacts", {"rut": "  "})["rut"] is None


def test_coerce_contact_bad_rut_left_raw_for_the_validator():
    # Must not raise: one bad row cannot abort the whole file.
    assert coerce_row("contacts", {"rut": "20442436-9"})["rut"] == "20442436-9"
