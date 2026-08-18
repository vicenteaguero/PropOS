"""Unit tests for app.core.rut helpers."""

from __future__ import annotations

import pytest

from app.core.rut import compute_dv, normalize_rut, parse_rut, validate_rut


class TestComputeDv:
    @pytest.mark.parametrize(
        "body,expected",
        [
            ("20442436", "5"),
            ("18123456", "3"),
            ("19234567", "7"),
            ("11111111", "1"),
            ("12345678", "5"),
        ],
    )
    def test_known_dvs(self, body: str, expected: str):
        assert compute_dv(body) == expected


class TestNormalizeRut:
    def test_strips_dots(self):
        assert normalize_rut("20.442.436-5") == "20442436-5"

    def test_uppercases_k(self):
        assert normalize_rut("12345678-k") == "12345678-K"

    def test_inserts_dash_when_missing(self):
        assert normalize_rut("204424365") == "20442436-5"

    def test_leaves_clean_rut_alone(self):
        assert normalize_rut("20442436-5") == "20442436-5"


class TestValidateRut:
    @pytest.mark.parametrize(
        "rut",
        ["20442436-5", "18123456-3", "19234567-7", "11111111-1"],
    )
    def test_valid_ruts(self, rut: str):
        assert validate_rut(rut) is True

    @pytest.mark.parametrize(
        "rut",
        ["20442436-9", "18123456-0", "12345678-K", "11111111-2"],
    )
    def test_wrong_dv_invalid(self, rut: str):
        assert validate_rut(rut) is False

    @pytest.mark.parametrize(
        "rut",
        ["", None, "abc", "20442436", "20442436-", "20.442.436-5"],
    )
    def test_malformed_invalid(self, rut: str | None):
        # Note: dotted form is rejected because validate_rut requires the
        # canonical format. normalize_rut() must be called first.
        assert validate_rut(rut) is False  # type: ignore[arg-type]


class TestParseRut:
    def test_normalizes_dotted_form(self):
        assert parse_rut("20.442.436-5") == "20442436-5"

    def test_uppercases_check_digit(self):
        assert parse_rut("12000008-k") == "12000008-K"

    def test_blank_and_none_pass_through(self):
        assert parse_rut(None) is None
        assert parse_rut("") is None
        assert parse_rut("   ") is None

    @pytest.mark.parametrize("rut", ["20442436-9", "abc", "1-1", "11111111-2"])
    def test_bad_rut_raises(self, rut: str):
        with pytest.raises(ValueError, match="RUT inválido"):
            parse_rut(rut)
