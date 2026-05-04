"""HMAC-SHA256 signature verification for Kapso webhooks."""
from __future__ import annotations

import hashlib
import hmac

SIGNATURE_HEADER = "x-webhook-signature"


def compute(secret: str, raw_body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def verify(secret: str, raw_body: bytes, header_value: str | None) -> bool:
    if not secret or not header_value:
        return False
    received = header_value.strip()
    if received.startswith("sha256="):
        received = received[len("sha256="):]
    expected = compute(secret, raw_body)
    try:
        return hmac.compare_digest(expected, received)
    except Exception:
        return False
