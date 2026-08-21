"""Phone normalization, which used to exist twice with different rules."""

from __future__ import annotations

import pytest

from app.core.phone import match_key, same_number, to_e164


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+56969564012", "+56969564012"),
        ("56969564012", "+56969564012"),
        ("0056969564012", "+56969564012"),
        ("969564012", "+56969564012"),
        ("9 6956 4012", "+56969564012"),
        ("(56) 9-6956-4012", "+56969564012"),
        # Eight digits is a mobile missing its 9, which is how portals send them.
        ("69564012", "+56969564012"),
    ],
)
def test_to_e164(raw: str, expected: str) -> None:
    assert to_e164(raw) == expected


@pytest.mark.parametrize("raw", [None, "", "abc", "1234", "+"])
def test_undialable_is_none(raw: str | None) -> None:
    assert to_e164(raw) is None


def test_match_key_ignores_how_it_was_written() -> None:
    assert match_key("+56 9 6956 4012") == match_key("969564012") == "69564012"


def test_same_number_across_spellings() -> None:
    assert same_number("+56969564012", "9 6956 4012")
    assert not same_number("+56969564012", "+56911111111")
    # Nothing matches nothing: an empty field is not "the same number".
    assert not same_number(None, None)
