"""Audio transcription with provider fallback.

Primary: Groq Whisper Large v3 (cheap LPU, español OK).
Fallback: OpenAI Whisper API.
Browser-side: Web Speech API result is just persisted (no provider call).
"""

from __future__ import annotations

import logging
from typing import IO

from app.core.config.settings import settings

logger = logging.getLogger("ANITA_TRANSCRIBE")


class TranscriptionError(Exception):
    pass


def transcribe_audio(file: IO[bytes], filename: str = "audio.webm") -> dict:
    """Transcribe audio blob via Groq → OpenAI fallback.

    Returns: {text, language, duration, source, raw}
    """
    provider = settings.anita_transcribe_provider

    try:
        if provider == "groq" and settings.groq_api_key:
            return _transcribe_groq(file, filename)
        if provider == "openai" and settings.openai_api_key:
            return _transcribe_openai(file, filename)
    except TranscriptionError as exc:
        logger.warning("primary transcribe failed: %s", exc)
        file.seek(0)

    # Fallback chain
    if provider != "openai" and settings.openai_api_key:
        return _transcribe_openai(file, filename)
    if provider != "groq" and settings.groq_api_key:
        return _transcribe_groq(file, filename)

    raise TranscriptionError(
        "No transcription provider available. Set GROQ_API_KEY or OPENAI_API_KEY."
    )


def _transcribe_groq(file: IO[bytes], filename: str) -> dict:
    if not settings.groq_api_key:
        raise TranscriptionError("GROQ_API_KEY not set")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionError("openai package not installed") from exc

    client = OpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    response = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(filename, file, "audio/webm"),
        language="es",
        response_format="verbose_json",
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
