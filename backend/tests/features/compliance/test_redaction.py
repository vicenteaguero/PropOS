"""Redaction of audit_log snapshots — Ley 21.719 Art. 14.

Redaction is irreversible and it is the only thing standing between an
"executed" erasure and a full copy of the subject's RUT, phone and e-mail
sitting in every audit row. So the assertions here are on the exact output,
not on a count.
"""

from __future__ import annotations

from app.features.compliance.service import PII_FIELDS, REDACTED, redact_snapshot


def test_redacts_every_pii_field_that_carries_a_value():
    snapshot = {
        "id": "c0ffee00-0000-0000-0000-000000000001",
        "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "full_name": "Juana Pérez",
        "email": "juana@example.cl",
        "phone": "+56911111111",
        "rut": "12.345.678-5",
        "birthdate": "1985-04-02",
        "address": "Av. Siempre Viva 742",
        "notes": "prefiere depto con estacionamiento",
        "created_at": "2026-01-01T00:00:00Z",
    }

    out = redact_snapshot(snapshot)

    for field in ("full_name", "email", "phone", "rut", "birthdate", "address", "notes"):
        assert out[field] == REDACTED, f"{field} was left readable"
    # Structural columns are what makes the row still auditable.
    assert out["id"] == snapshot["id"]
    assert out["tenant_id"] == snapshot["tenant_id"]
    assert out["created_at"] == snapshot["created_at"]


def test_does_not_invent_values_over_nulls():
    """A key that was NULL stays NULL.

    Writing the placeholder over it would claim the row once held data it never
    held, which corrupts the ledger it is supposed to preserve.
    """
    out = redact_snapshot({"full_name": "Juana", "email": None, "rut": None})

    assert out["full_name"] == REDACTED
    assert out["email"] is None
    assert out["rut"] is None


def test_leaves_absent_keys_absent():
    out = redact_snapshot({"full_name": "Juana"})

    assert set(out) == {"full_name"}


def test_none_snapshot_stays_none():
    """`audit_log.before` is NULL on INSERT and `after` is NULL on DELETE."""
    assert redact_snapshot(None) is None


def test_does_not_mutate_the_input():
    original = {"full_name": "Juana", "email": "juana@example.cl"}

    redact_snapshot(original)

    assert original == {"full_name": "Juana", "email": "juana@example.cl"}


def test_covers_the_free_text_columns_that_carry_third_party_data():
    """Message bodies and transcripts name people other than the subject."""
    snapshot = {
        "content": "hola, soy Juana, mi RUT es 12.345.678-5",
        "body_text": "adjunto liquidación",
        "text": "transcripción de la nota de voz",
        "payload": {"from": "+56911111111"},
        "proof": {"ip": "1.2.3.4"},
        "metadata": {"origen": "portal"},
    }

    out = redact_snapshot(snapshot)

    assert all(out[k] == REDACTED for k in snapshot)


def test_field_list_is_a_superset_of_the_contacts_pii_columns():
    """Guards against a schema column being added and never redacted."""
    contacts_pii = {"full_name", "email", "phone", "rut", "birthdate", "address", "notes", "metadata", "consent"}

    assert contacts_pii <= set(PII_FIELDS)


def test_explicit_field_list_is_honoured():
    out = redact_snapshot({"full_name": "Juana", "email": "juana@example.cl"}, fields=("email",))

    assert out["full_name"] == "Juana"
    assert out["email"] == REDACTED
