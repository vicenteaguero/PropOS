from __future__ import annotations

import secrets
import string

ALPHABET = string.ascii_lowercase + string.digits


def generate_slug(length: int = 8) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))
