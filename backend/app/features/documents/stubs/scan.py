from __future__ import annotations

from typing import Literal

from app.core.logging.logger import get_logger

logger = get_logger("SCAN_STUB")

ScanStatus = Literal["clean", "infected", "error", "skipped"]


def scan_file(content: bytes) -> ScanStatus:
    """V1 stub: marca como 'skipped' (NO 'clean' — eso falsificaría señal de seguridad).
    V2 conectar ClamAV (clamd) o servicio externo y retornar 'clean'/'infected'."""
    logger.warning(
        "antivirus stub invoked, returning 'skipped' (no real scan)",
        event_type="stub",
        size=len(content),
    )
    return "skipped"
