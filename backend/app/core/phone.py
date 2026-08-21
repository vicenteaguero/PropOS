"""One way to write a phone number, for the whole system.

There were two, against the same `contacts.phone` column: the WhatsApp webhook
matched `.eq(phone, e164)` and the e-mail sync matched `.ilike('%' || digits)`.
A number stored one way was invisible to the other path, which is how the same
person became two contacts depending on which channel they used first.

Chile only, deliberately. Guessing a country from a bare 9-digit string is how
you end up dialling the wrong hemisphere; when a second country arrives it gets
an explicit argument, not a heuristic.
"""

from __future__ import annotations

import re

#: +56 9 XXXX XXXX — Chilean mobiles are 9 digits after the country code.
_CL_CODE = "56"
_NATIONAL_LEN = 9


def to_e164(raw: str | None) -> str | None:
    """A dialable `+56XXXXXXXXX`, or None when there is not enough to dial.

    Accepts anything a human or a portal writes: `9 6956 4012`, `+56 9 6956
    4012`, `0056969564012`, `(56) 9-6956-4012`.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None
    digits = digits.removeprefix("00")
    if digits.startswith(_CL_CODE) and len(digits) > _NATIONAL_LEN:
        digits = digits[len(_CL_CODE) :]
    if len(digits) < 8:
        return None
    if len(digits) == 8:
        # A mobile written without its leading 9, which portals do constantly.
        digits = f"9{digits}"
    return f"+{_CL_CODE}{digits[-_NATIONAL_LEN:]}"


def match_key(raw: str | None) -> str | None:
    """The last 8 digits — what two spellings of one number have in common.

    Used to FIND a number, never to store or dial one. A landline written with
    its area code and a mobile written without its 9 both reduce to this, which
    is the only reliable way to catch a duplicate that was typed differently.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return None
    if digits.startswith(_CL_CODE) and len(digits) > _NATIONAL_LEN:
        digits = digits[len(_CL_CODE) :]
    return digits[-8:] if len(digits) >= 8 else digits


def same_number(left: str | None, right: str | None) -> bool:
    """True when two spellings are the same line."""
    a, b = match_key(left), match_key(right)
    return bool(a) and a == b
