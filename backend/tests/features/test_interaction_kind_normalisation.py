"""Propo's `kind` has to land on the `interaction_kind` enum.

The classifier speaks channel vocabulary — "whatsapp" — while the column is an
enum whose value is `WHATSAPP_LOG`. Nothing validated it, so the INSERT died
with `invalid input value for enum interaction_kind` and the broker got a 500
for a proposal the app had offered them. There was a seeded proposal in exactly
that state, so it was reachable by clicking Aceptar.
"""

from __future__ import annotations

import pytest

from app.features.agent.tools.executors import _INTERACTION_KINDS, _normalise_interaction_kind


@pytest.mark.parametrize(
    ("said", "expected"),
    [
        ("whatsapp", "WHATSAPP_LOG"),
        ("WhatsApp", "WHATSAPP_LOG"),
        ("mensaje", "WHATSAPP_LOG"),
        ("correo", "EMAIL"),
        ("llamada", "CALL"),
        ("visita", "VISIT"),
        ("reunion", "MEETING"),
        # Already an enum value: untouched.
        ("CALL", "CALL"),
        ("WHATSAPP_LOG", "WHATSAPP_LOG"),
    ],
)
def test_what_the_classifier_says_becomes_what_the_column_accepts(said, expected):
    assert _normalise_interaction_kind(said) == expected


@pytest.mark.parametrize("said", ["telepatía", "", None, 42, "  "])
def test_anything_unrecognised_files_under_other_rather_than_failing(said):
    """The interaction is real — somebody said it in a conversation. Losing it
    to a taxonomy mismatch is worse than filing it under OTHER, which the
    broker can correct."""
    assert _normalise_interaction_kind(said) == "OTHER"


def test_every_result_is_a_value_the_enum_actually_has():
    """The guarantee that matters: no output of this function can 500 the insert."""
    for said in ["whatsapp", "correo", "telepatía", None, "SHOWING", "nota", "phone"]:
        assert _normalise_interaction_kind(said) in _INTERACTION_KINDS


def test_the_local_enum_copy_matches_the_database():
    """`_INTERACTION_KINDS` is a copy of a Postgres enum. If the enum gains a
    value and this does not, the new kind silently normalises to OTHER.
    """
    import re
    from pathlib import Path

    migrations = Path(__file__).resolve().parents[2].parent / "supabase" / "migrations"
    declared: set[str] = set()
    for sql in sorted(migrations.glob("*.sql")):
        match = re.search(
            r"CREATE TYPE interaction_kind AS ENUM\s*\((.*?)\)",
            sql.read_text(encoding="utf-8"),
            re.DOTALL,
        )
        if match:
            declared = set(re.findall(r"'([^']+)'", match.group(1)))
    assert declared, "could not find the interaction_kind enum in the migrations"
    assert declared == set(_INTERACTION_KINDS)
