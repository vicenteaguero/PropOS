"""Sync local template registry → Kapso (Meta) for approval.

Reads ``app.features.notifications.whatsapp.templates.REGISTRY`` and POSTs
each entry to Kapso's template create endpoint. Idempotent: existing
templates with the same name are skipped (Kapso 409).
"""
from __future__ import annotations

import asyncio

import httpx

from app.core.config.settings import settings
from app.features.notifications.whatsapp import templates


def _to_kapso_payload(t: templates.Template) -> dict:
    return {
        "name": t.name,
        "category": t.category.upper(),
        "language": t.language,
        "components": [{"type": "BODY", "text": t.body}],
    }


async def main() -> None:
    if not settings.kapso_api_key:
        raise SystemExit("KAPSO_API_KEY missing")

    url = f"{settings.kapso_base_url.rstrip('/')}/{settings.kapso_phone_number_id}/message_templates"
    headers = {"X-API-Key": settings.kapso_api_key, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as http:
        for t in templates.REGISTRY.values():
            payload = _to_kapso_payload(t)
            resp = await http.post(url, headers=headers, json=payload)
            print(f"{t.name}: {resp.status_code} {resp.text[:200]}")


if __name__ == "__main__":
    asyncio.run(main())
