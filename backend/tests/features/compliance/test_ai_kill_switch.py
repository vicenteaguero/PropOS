"""AI kill switch — Ley 21.719 Art. 27.

The DPA with Groq is unsigned while Groq already processes every prompt and
voice note. The RAT's registered mitigation is an operable interruptor, so it
has to actually stop the call rather than degrade into a silent empty answer.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import ai_guard
from app.core.config.settings import Settings, settings


def test_processing_is_enabled_by_default():
    """Turning the product off by default would be a different bug."""
    assert settings.ai_processing_enabled is True
    assert ai_guard.ai_processing_enabled() is True


def test_the_switch_is_reachable_from_the_environment():
    """It has to be flippable without a code deploy — that is the whole point."""
    assert "AI_PROCESSING_ENABLED".lower() in Settings.model_fields


def test_disabled_raises_503_not_an_empty_result(monkeypatch):
    monkeypatch.setattr(settings, "ai_processing_enabled", False)

    with pytest.raises(HTTPException) as exc:
        ai_guard.assert_ai_processing_enabled()

    assert exc.value.status_code == 503
    assert "AI_PROCESSING_ENABLED" in exc.value.detail


def test_enabled_does_not_raise(monkeypatch):
    monkeypatch.setattr(settings, "ai_processing_enabled", True)

    ai_guard.assert_ai_processing_enabled()
