from __future__ import annotations

from typing import Literal

from app.core.logging.logger import get_logger

logger = get_logger("SCAN_STUB")

ScanStatus = Literal["clean", "infected", "error", "skipped"]


def scan_file(content: bytes) -> ScanStatus:
    """V1 stub: marca todo como clean. V2 conectar ClamAV (clamd) o servicio externo."""
    logger.warning(
        "antivirus stub invoked, returning 'clean'",
        event_type="stub",
        size=len(content),
    )
    return "clean"
