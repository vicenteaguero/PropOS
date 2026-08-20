"""Audio transcription with provider fallback.

Primary: Groq Whisper Large v3 (cheap LPU, español OK).
Fallback: OpenAI Whisper API.
Browser-side: Web Speech API result is just persisted (no provider call).
"""

from __future__ import annotations

import logging
import time
from typing import IO
from uuid import UUID

from app.core.config.settings import settings

logger = logging.getLogger("AGENT_TRANSCRIBE")


class TranscriptionError(Exception):
    """Base for anything that stops a transcription.

    Subclassed so the router can pick an honest status code. Every failure used
    to collapse into one 503 — a revoked key, a rate limit, a cold-start timeout
    and "no provider configured" were indistinguishable both to the client and
    to whoever was reading the logs.
    """


class TranscriptionUnavailableError(TranscriptionError):
    """No provider is configured. A deployment problem, not a runtime one. → 503"""


class TranscriptionQuotaError(TranscriptionError):
    """The provider's rate limit or daily budget is spent. Retrying later works. → 429"""


class TranscriptionProviderError(TranscriptionError):
    """The provider rejected the call or timed out. Not the client's fault. → 502"""


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
    provider = settings.agent_transcribe_provider
    if vocab is None:
        vocab = _cached_whisper_vocab(tenant_id)

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

    raise TranscriptionUnavailableError("no transcription provider configured; set GROQ_API_KEY or OPENAI_API_KEY")


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


# Tenant vocab cache. Building it costs FOUR sequential Supabase round-trips,
# and it was rebuilt on every single transcription — on a cold Cloud Run
# instance that ate a large slice of the 30s client timeout before the audio
# had even been uploaded. Names change slowly; ten minutes is plenty.
_VOCAB_TTL_SECONDS = 600
_vocab_cache: dict[str, tuple[float, str]] = {}


def _cached_whisper_vocab(tenant_id: UUID) -> str:
    key = str(tenant_id)
    hit = _vocab_cache.get(key)
    now = time.monotonic()
    if hit is not None and now - hit[0] < _VOCAB_TTL_SECONDS:
        return hit[1]
    vocab = build_whisper_vocab(tenant_id)
    _vocab_cache[key] = (now, vocab)
    return vocab


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

        people = [
            r["full_name"]
            for r in c.table("contacts")
            .select("full_name")
            .eq("tenant_id", tid)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(40)
            .execute()
            .data
            if r.get("full_name")
        ]
        props = [
            r["title"]
            for r in c.table("properties")
            .select("title")
            .eq("tenant_id", tid)
            .is_("deleted_at", "null")
            .order("updated_at", desc=True)
            .limit(20)
            .execute()
            .data
            if r.get("title")
        ]
        orgs = [
            r["name"]
            for r in c.table("organizations")
            .select("name")
            .eq("tenant_id", tid)
            .is_("deleted_at", "null")
            .order("name")
            .limit(20)
            .execute()
            .data
            if r.get("name")
        ]
        projects = [
            r["name"]
            for r in c.table("projects")
            .select("name")
            .eq("tenant_id", tid)
            .is_("deleted_at", "null")
            .order("updated_at", desc=True)
            .limit(10)
            .execute()
            .data
            if r.get("name")
        ]
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
        raise TranscriptionUnavailableError("GROQ_API_KEY not set")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionUnavailableError("openai package not installed") from exc

    from app.features.agent.rate_limiter import QuotaExhaustedError, get_rate_limiter

    try:
        get_rate_limiter().acquire_sync("groq", "whisper-large-v3", est_tokens=0)
    except QuotaExhaustedError as exc:
        # Surfaces as 503 through the router instead of parking the request
        # until the daily Whisper window rolls over.
        raise TranscriptionQuotaError(str(exc)) from exc

    client = OpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
        timeout=30.0,
        max_retries=1,
    )
    try:
        response = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=(filename, file, "audio/webm"),
            language="es",
            response_format="verbose_json",
            prompt=vocab or _WHISPER_VOCAB_STATIC,
        )
    except Exception as exc:
        raise TranscriptionProviderError(f"groq whisper failed: {exc}") from exc
    return {
        "text": response.text,
        "language": getattr(response, "language", "es"),
        "duration": getattr(response, "duration", None),
        "source": "groq_whisper",
        "raw": response.model_dump() if hasattr(response, "model_dump") else dict(response),
    }


def _transcribe_openai(file: IO[bytes], filename: str) -> dict:
    if not settings.openai_api_key:
        raise TranscriptionUnavailableError("OPENAI_API_KEY not set")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionUnavailableError("openai package not installed") from exc

    client = OpenAI(api_key=settings.openai_api_key, timeout=30.0, max_retries=1)
    try:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, file, "audio/webm"),
            language="es",
            response_format="verbose_json",
        )
    except Exception as exc:
        raise TranscriptionProviderError(f"openai whisper failed: {exc}") from exc
    return {
        "text": response.text,
        "language": getattr(response, "language", "es"),
        "duration": getattr(response, "duration", None),
        "source": "openai_whisper",
        "raw": response.model_dump() if hasattr(response, "model_dump") else dict(response),
    }
