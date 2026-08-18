"""RUT validation on the CRM write schemas (contacts, organizations, import)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.features.contacts.schemas import ContactCreate, ContactResponse, ContactUpdate
from app.features.imports.service import _VALIDATORS
from app.features.organizations.schemas import OrganizationCreate, OrganizationUpdate

VALID_RUT = "20442436-5"


class TestContactSchemas:
    def test_valid_rut_is_canonicalized(self):
        assert ContactCreate(full_name="Ana", rut="20.442.436-5").rut == VALID_RUT

    def test_bad_check_digit_rejected(self):
        with pytest.raises(ValidationError, match="RUT inválido"):
            ContactCreate(full_name="Ana", rut="20442436-9")

    def test_garbage_rejected(self):
        with pytest.raises(ValidationError):
            ContactCreate(full_name="Ana", rut="no-soy-un-rut")

    def test_rut_stays_optional(self):
        assert ContactCreate(full_name="Ana").rut is None
        assert ContactCreate(full_name="Ana", rut="").rut is None

    def test_update_schema_validates_too(self):
        assert ContactUpdate(rut="20.442.436-5").rut == VALID_RUT
        with pytest.raises(ValidationError):
            ContactUpdate(rut="20442436-9")

    def test_response_schema_tolerates_legacy_rows(self):
        # Reads must not 500 on RUTs stored before the validator existed.
        row = {
            "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "full_name": "Legacy",
            "rut": "sin-formato",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        assert ContactResponse(**row).rut == "sin-formato"


class TestOrganizationSchemas:
    def test_valid_rut_is_canonicalized(self):
        assert OrganizationCreate(name="Notaría", rut="20.442.436-5").rut == VALID_RUT

    def test_bad_rut_rejected(self):
        with pytest.raises(ValidationError, match="RUT inválido"):
            OrganizationCreate(name="Notaría", rut="20442436-9")

    def test_update_schema_validates_too(self):
        with pytest.raises(ValidationError):
            OrganizationUpdate(rut="1-1")


def test_import_validator_inherits_contact_rut_rule():
    # The CSV import validates rows with ContactCreate, so the rule flows through.
    assert _VALIDATORS["contacts"] is ContactCreate
    with pytest.raises(ValidationError):
        _VALIDATORS["contacts"](full_name="Ana", rut="20442436-9")
