"""Resend HTTP client. Thin wrapper over the REST API.

We deliberately use httpx instead of the resend SDK to avoid an extra
dependency — the API surface we use is a single endpoint.
"""

from __future__ import annotations

import httpx

from app.core.config.settings import settings
from app.core.logging.logger import get_logger

logger = get_logger("EMAIL")

_RESEND_API = "https://api.resend.com/emails"


class ResendError(RuntimeError):
    pass


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    reply_to: str | None = None,
    headers: dict[str, str] | None = None,
    from_override: str | None = None,
) -> str:
    """Send a transactional email via Resend. Returns the Resend message id.

    ``headers`` carries RFC threading headers (In-Reply-To / References) so
    email replies stitch into the original conversation. ``from_override``
    lets a reply send from the tenant's verified mailbox instead of the
    default transactional sender.
    """
    api_key = settings.resend_api_key
    if not api_key:
        raise ResendError("RESEND_API_KEY not configured")

    payload: dict = {
        "from": from_override or settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if reply_to:
        payload["reply_to"] = reply_to
    if headers:
        payload["headers"] = headers

    async with httpx.AsyncClient(timeout=15.0) as http:
        resp = await http.post(
            _RESEND_API,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if resp.status_code >= 300:
        logger.error(
            "resend_failed",
            event_type="error",
            status=resp.status_code,
            body=resp.text[:500],
        )
        raise ResendError(f"Resend {resp.status_code}: {resp.text}")
    data = resp.json()
    message_id = data.get("id", "")
    logger.info("resend_sent", event_type="write", message_id=message_id, to=to)
    return message_id
