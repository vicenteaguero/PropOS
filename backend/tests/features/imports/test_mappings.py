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


class TestPropertyHeaderAliases:
    def test_spanish_headers_map_to_columns(self):
        assert map_header("properties", "Dirección") == "address"
        assert map_header("properties", "Dormitorios") == "bedrooms"
        assert map_header("properties", "Baños") == "bathrooms"
        assert map_header("properties", "Superficie") == "area_sqm"
        assert map_header("properties", "Precio") == "list_price_cents"
        assert map_header("properties", "Moneda") == "currency"

    def test_broker_specific_headers(self):
        assert map_header("properties", "Comuna") == "comuna"
        assert map_header("properties", "Tipo") == "property_type"
        assert map_header("properties", "Operación") == "listing_kind"
        assert map_header("properties", "Estado") == "status"
        assert map_header("properties", "Estacionamientos") == "parking_count"

    def test_unknown_header_ignored(self):
        assert map_header("properties", "columna rara") is None


class TestPropertyCoercion:
    def test_price_pesos_to_cents(self):
        out = coerce_row("properties", {"title": "Casa", "list_price_cents": "$ 90.000.000"})
        assert out["list_price_cents"] == 90_000_000_00

    def test_area_with_decimal_comma(self):
        assert coerce_row("properties", {"title": "Casa", "area_sqm": "120,5"})["area_sqm"] == 120.5

    def test_area_with_thousand_dot(self):
        assert coerce_row("properties", {"title": "Sitio", "lot_sqm": "1.200"})["lot_sqm"] == 1200.0

    def test_rooms_are_integers(self):
        out = coerce_row("properties", {"title": "Casa", "bedrooms": "3", "bathrooms": "2"})
        assert out["bedrooms"] == 3
        assert out["bathrooms"] == 2

    def test_spanish_status_and_operation_normalized(self):
        out = coerce_row("properties", {"title": "Casa", "status": "Disponible", "listing_kind": "Arriendo"})
        assert out["status"] == "AVAILABLE"
        assert out["listing_kind"] == "RENT"

    def test_unknown_status_upper_cased_for_the_validator(self):
        assert coerce_row("properties", {"title": "Casa", "status": "raro"})["status"] == "RARO"

    def test_extra_broker_columns_land_in_metadata(self):
        out = coerce_row(
            "properties",
            {
                "title": "Casa",
                "comuna": "Rancagua",
                "property_type": "Casa",
                "parking_count": "2",
                "bodega": "ignored",
                "has_storage": "sí",
                "owner_name": "Juan Pérez",
            },
        )
        assert "comuna" not in out
        assert out["metadata"]["comuna"] == "Rancagua"
        assert out["metadata"]["parking_count"] == 2
        assert out["metadata"]["has_storage"] is True
        assert out["metadata"]["owner_name"] == "Juan Pérez"

    def test_address_becomes_title_when_missing(self):
        assert coerce_row("properties", {"address": "Av. Siempre Viva 742"})["title"] == "Av. Siempre Viva 742"

    def test_blank_cells_are_dropped_not_sent_empty(self):
        out = coerce_row("properties", {"title": "Casa", "status": "", "currency": "", "bedrooms": ""})
        assert "status" not in out
        assert "currency" not in out
        assert "bedrooms" not in out

    def test_currency_upper_cased(self):
        assert coerce_row("properties", {"title": "Casa", "currency": "uf"})["currency"] == "UF"


class TestPropertyRowValidates:
    def test_coerced_row_passes_property_create(self):
        from app.features.imports.service import _VALIDATORS

        raw = {
            "title": "Casa en Rancagua",
            "address": "Av. Siempre Viva 742",
            "comuna": "Rancagua",
            "listing_kind": "Venta",
            "status": "Disponible",
            "bedrooms": "3",
            "bathrooms": "2",
            "area_sqm": "120,5",
            "list_price_cents": "90.000.000",
            "currency": "CLP",
        }
        model = _VALIDATORS["properties"](**coerce_row("properties", raw))
        assert model.title == "Casa en Rancagua"
        assert model.list_price_cents == 90_000_000_00
        assert model.area_sqm == 120.5
        assert model.metadata["comuna"] == "Rancagua"
        assert model.listing_kind.value == "SALE"
        assert model.status.value == "AVAILABLE"
