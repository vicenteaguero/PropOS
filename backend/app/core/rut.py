"""Chilean RUT helpers.

A RUT (Rol Único Tributario) is a national tax/identity ID. Format used in
this app is canonical: ``NNNNNNNN-D`` where ``D`` is a single check digit
0-9 or K, computed via mod-11 over the body digits.
"""

from __future__ import annotations

import re

_RUT_FORMAT = re.compile(r"^(\d{7,8})-([0-9Kk])$")


def normalize_rut(raw: str) -> str:
    """Strip dots and uppercase the check digit. Does not validate dv."""
    cleaned = raw.replace(".", "").replace(" ", "").strip()
    if "-" not in cleaned:
        cleaned = f"{cleaned[:-1]}-{cleaned[-1]}"
    body, _, dv = cleaned.rpartition("-")
    return f"{body}-{dv.upper()}"


def compute_dv(body: str) -> str:
    """Compute the mod-11 check digit for the numeric body."""
    total = 0
    multiplier = 2
    for digit in reversed(body):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1
    remainder = 11 - (total % 11)
    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


def validate_rut(rut: str) -> bool:
    """Return True iff ``rut`` matches canonical format and dv is correct."""
    if not rut:
        return False
    match = _RUT_FORMAT.match(rut)
    if not match:
        return False
    body, dv = match.group(1), match.group(2).upper()
    return compute_dv(body) == dv
