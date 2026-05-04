"""Thin async httpx wrapper for Kapso WhatsApp Cloud API proxy.

Auth: X-API-Key header. Base URL configurable via settings.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config.settings import settings
from app.core.logging.logger import get_logger

logger = get_logger("KAPSO_CLIENT")


class KapsoError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, body: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _headers() -> dict[str, str]:
    return {
        "X-API-Key": settings.kapso_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _phone_path() -> str:
    pid = settings.kapso_phone_number_id
    if not pid:
        raise KapsoError("kapso_phone_number_id not configured")
    return f"/{pid}"


async def _post(path: str, json: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.kapso_base_url.rstrip('/')}{path}"
    async with httpx.AsyncClient(timeout=15.0) as http:
        resp = await http.post(url, headers=_headers(), json=json)
    if resp.status_code >= 400:
        logger.warning(
            "kapso_api_error",
            event_type="kapso",
            status=resp.status_code,
            body=resp.text[:500],
            path=path,
        )
        raise KapsoError(
            f"Kapso {resp.status_code}: {resp.text[:200]}",
            status_code=resp.status_code,
            body=resp.text,
        )
    return resp.json() if resp.content else {}


async def send_text(to_e164: str, body: str) -> dict[str, Any]:
    """Send a freeform text message. Only valid inside the 24h window."""
    # Meta Cloud API expects `to` without leading `+`.
    to = to_e164.lstrip("+")
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": body[:4096]},
    }
    return await _post(f"{_phone_path()}/messages", payload)


async def send_template(
    to_e164: str,
    template_name: str,
    variables: list[str] | None = None,
    lang: str | None = None,
) -> dict[str, Any]:
    """Send an HSM template. Variables map to {{1}}, {{2}}, ... in the body."""
    to = to_e164.lstrip("+")
    components: list[dict[str, Any]] = []
    if variables:
        components.append(
            {
                "type": "body",
                "parameters": [{"type": "text", "text": str(v)} for v in variables],
            }
        )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang or settings.kapso_default_template_lang},
            "components": components,
        },
    }
    return await _post(f"{_phone_path()}/messages", payload)


async def mark_read(message_id: str) -> dict[str, Any]:
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }
    try:
        return await _post(f"{_phone_path()}/messages", payload)
    except KapsoError as exc:
        logger.info("kapso_mark_read_failed", event_type="kapso", error=str(exc))
        return {}
