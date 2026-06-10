"""AI property-description generator for portal listings.

Groq-only (same hardcoded endpoint as the agent classifier), routed through
the shared rate limiter to respect the free-tier quota. Output is Spanish and
is NOT persisted — the frontend shows it editable and saves via PATCH.
"""

from __future__ import annotations

import json
from uuid import UUID

from app.core.config.settings import settings
from app.core.supabase.client import get_supabase_client

_PROMPT = """\
Eres un redactor inmobiliario chileno. Escribe una descripción atractiva y
honesta para un portal inmobiliario, en español de Chile, tono {tone}.
Máximo {max_words} palabras. NO inventes datos que no estén en la ficha.

Ficha de la propiedad (JSON):
{facts}

Devuelve SOLO JSON válido con esta forma:
{{"title_suggestion": "...", "description": "...", "highlights": ["...", "..."]}}
"""


async def generate_description(property_id: UUID, tenant_id: UUID, tone: str, portal: str, max_words: int) -> dict:
    from openai import AsyncOpenAI

    from app.features.agent.rate_limiter import get_rate_limiter

    client = get_supabase_client()
    prop = (
        client.table("properties")
        .select(
            "title, address, description, bedrooms, bathrooms, area_sqm, lot_sqm, "
            "list_price_cents, currency, listing_kind, year_built"
        )
        .eq("id", str(property_id))
        .eq("tenant_id", str(tenant_id))
        .single()
        .execute()
        .data
    )
    facts = {k: v for k, v in (prop or {}).items() if v not in (None, "")}
    prompt = _PROMPT.format(tone=tone, max_words=max_words, facts=json.dumps(facts, ensure_ascii=False))

    await get_rate_limiter().acquire(settings.agent_provider, settings.agent_model, len(prompt) // 4)
    llm = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
    completion = await llm.chat.completions.create(
        model=settings.agent_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=600,
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {"title_suggestion": prop.get("title", ""), "description": raw, "highlights": []}
    return {
        "title_suggestion": data.get("title_suggestion") or prop.get("title", ""),
        "description": data.get("description") or "",
        "highlights": data.get("highlights") or [],
    }
