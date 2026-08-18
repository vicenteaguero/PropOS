"""Kill switch for the AI sub-processor.

Ley 21.719 Art. 27: every prompt, CRM snippet and voice note the assistant
handles crosses the border to Groq Inc. (US), and the DPA that would cover
that transfer is not signed yet — see `docs/compliance/dpa-subprocessors.md`.
The registered mitigation is an interruptor that an operator can actually
reach: flipping `AI_PROCESSING_ENABLED=false` stops the transfer on the next
Cloud Run revision without touching, rebuilding or rolling back code.

Call `assert_ai_processing_enabled()` at the top of every function that talks
to the provider (classifier, text_to_sql, transcribe, property describe, client
agent). It raises a 503 rather than degrading silently: a caller that quietly
returned an empty answer would look like "the CRM has no data", which is the
failure mode 20240601000049 was written about.
"""

from __future__ import annotations

from fastapi import HTTPException, status

from app.core.config.settings import settings

DISABLED_DETAIL = "AI processing is disabled by the AI_PROCESSING_ENABLED kill switch"


def ai_processing_enabled() -> bool:
    """True when calls to the AI sub-processor are permitted.

    Read through this helper rather than off `settings` directly so the
    non-HTTP callers (jobs, channel adapters) share one decision point.
    """
    return bool(settings.ai_processing_enabled)


def assert_ai_processing_enabled() -> None:
    """Raise 503 when the kill switch is off."""
    if not ai_processing_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=DISABLED_DETAIL,
        )
