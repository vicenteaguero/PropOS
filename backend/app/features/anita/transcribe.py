"""Audio transcription with provider fallback.

Primary: Groq Whisper Large v3 (cheap LPU, español OK).
Fallback: OpenAI Whisper API.
Browser-side: Web Speech API result is just persisted (no provider call).
"""

from __future__ import annotations

import logging
from typing import IO
from uuid import UUID

from app.core.config.settings import settings

logger = logging.getLogger("ANITA_TRANSCRIBE")


class TranscriptionError(Exception):
    pass


def transcribe_audio(
    file: IO[bytes],
    filename: str = "audio.webm",
    *,
    tenant_id: UUID | None = None,
    vocab: str | None = None,
) -> dict:
    """Transcribe audio blob via Groq → OpenAI fallback.

    `tenant_id`: when provided, builds a tenant-specific Whisper vocab
    from the tenant's people/properties/orgs (boosts name recall).
    `vocab`: explicit override (testing).

    Returns: {text, language, duration, source, raw}
    """
    provider = settings.anita_transcribe_provider
    if vocab is None:
        vocab = build_whisper_vocab(tenant_id)

    try:
        if provider == "groq" and settings.groq_api_key:
            return _transcribe_groq(file, filename, vocab=vocab)
        if provider == "openai" and settings.openai_api_key:
            return _transcribe_openai(file, filename)
    except TranscriptionError as exc:
        logger.warning("primary transcribe failed: %s", exc)
        file.seek(0)

    # Fallback chain
    if provider != "openai" and settings.openai_api_key:
        return _transcribe_openai(file, filename)
    if provider != "groq" and settings.groq_api_key:
        return _transcribe_groq(file, filename, vocab=vocab)

    raise TranscriptionError("No transcription provider available. Set GROQ_API_KEY or OPENAI_API_KEY.")


# Static, generic Whisper vocab — Chilean real-estate terminology + comunas.
# NO entity names here (those come from the tenant DB at call time).
# Whisper's `prompt` parameter caps at ~224 tokens.
_WHISPER_VOCAB_STATIC = (
    "Inmobiliaria chilena. Marcas y productos: ANAIDA, CETER, PropOS, "
    "WhatsApp, Meta Ads, Community Manager. "
    "Comunas: Vitacura, Las Condes, Providencia, Ñuñoa, La Reina, "
    "Lo Barnechea, Santiago Centro, Maipú, La Florida, Apoquindo, "
    "Chicureo, Curicó, Rancagua, Machalí, Lampa, Colina, Peñalolén, Macul. "
    "Términos: RUT, lucas, palos, dormitorios, baños, estacionamientos, "
    "bodega, gastos comunes, propiedad, departamento, parcela, terreno, "
    "comprador, vendedor, notaría, escritura, hipoteca. "
    "Personas frecuentes del equipo: Jaime Agüero, Vicente Agüero, Ana Carreño."
)


def build_whisper_vocab(tenant_id: UUID | None = None) -> str:
    """Build a per-tenant Whisper prompt by mixing static jargon with the
    tenant's actual people, properties, organisations, and projects.

    The DB grows organically → vocab quality improves over time. Capped
    at ~200 tokens so Whisper doesn't truncate the speech context.
    """
    if tenant_id is None:
        return _WHISPER_VOCAB_STATIC

    try:
        from app.core.supabase.client import get_supabase_client
        c = get_supabase_client()
        tid = str(tenant_id)

        people = [r["full_name"] for r in c.table("contacts").select("full_name")
                  .eq("tenant_id", tid).is_("deleted_at", "null")
                  .order("created_at", desc=True).limit(40).execute().data
                  if r.get("full_name")]
        props = [r["title"] for r in c.table("properties").select("title")
                 .eq("tenant_id", tid).is_("deleted_at", "null")
                 .order("updated_at", desc=True).limit(20).execute().data
                 if r.get("title")]
        orgs = [r["name"] for r in c.table("organizations").select("name")
                .eq("tenant_id", tid).is_("deleted_at", "null")
                .order("name").limit(20).execute().data
                if r.get("name")]
        projects = [r["name"] for r in c.table("projects").select("name")
                    .eq("tenant_id", tid).is_("deleted_at", "null")
                    .order("updated_at", desc=True).limit(10).execute().data
                    if r.get("name")]
    except Exception:  # pragma: no cover — defensive: vocab is best-effort
        return _WHISPER_VOCAB_STATIC

    parts = [_WHISPER_VOCAB_STATIC]
    if people:
        parts.append("Personas: " + ", ".join(people[:30]) + ".")
    if props:
        parts.append("Propiedades: " + ", ".join(props[:15]) + ".")
    if orgs:
        parts.append("Organizaciones: " + ", ".join(orgs[:10]) + ".")
    if projects:
        parts.append("Proyectos: " + ", ".join(projects) + ".")
    full = " ".join(parts)
    # Whisper hint cap: ~224 tokens ≈ 1300 chars. Trim if needed.
    return full[:1300]


def _transcribe_groq(file: IO[bytes], filename: str, vocab: str | None = None) -> dict:
    if not settings.groq_api_key:
        raise TranscriptionError("GROQ_API_KEY not set")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionError("openai package not installed") from exc

    from app.features.anita.rate_limiter import get_rate_limiter

    get_rate_limiter().acquire_sync("groq", "whisper-large-v3", est_tokens=0)

    client = OpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    response = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(filename, file, "audio/webm"),
        language="es",
        response_format="verbose_json",
        prompt=vocab or _WHISPER_VOCAB_STATIC,
    )
    return {
        "text": response.text,
        "language": getattr(response, "language", "es"),
        "duration": getattr(response, "duration", None),
        "source": "groq_whisper",
        "raw": response.model_dump() if hasattr(response, "model_dump") else dict(response),
    }


def _transcribe_openai(file: IO[bytes], filename: str) -> dict:
    if not settings.openai_api_key:
        raise TranscriptionError("OPENAI_API_KEY not set")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionError("openai package not installed") from exc

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, file, "audio/webm"),
        language="es",
        response_format="verbose_json",
    )
    return {
        "text": response.text,
        "language": getattr(response, "language", "es"),
        "duration": getattr(response, "duration", None),
        "source": "openai_whisper",
        "raw": response.model_dump() if hasattr(response, "model_dump") else dict(response),
    }
