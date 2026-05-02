"""Static rate-limit registry per (provider, model).

Source of truth for the in-process `RateLimiter`. Update whenever the
provider changes a tier or we move to a paid plan. Values come from the
provider dashboard, not guesswork.

A value of `0` means "unlimited or not advertised" — the limiter treats
it as a no-op for that window.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelLimits:
    rpm: int          # requests per minute
    rpd: int          # requests per day
    tpm: int          # tokens per minute
    tpd: int          # tokens per day


# (provider, model) → ModelLimits
LIMITS: dict[tuple[str, str], ModelLimits] = {
    # ── Groq free tier (chat) ────────────────────────────────────────
    ("groq", "llama-3.3-70b-versatile"):              ModelLimits(rpm=30,  rpd=1_000,  tpm=12_000, tpd=100_000),
    ("groq", "qwen/qwen3-32b"):                       ModelLimits(rpm=60,  rpd=1_000,  tpm=6_000,  tpd=500_000),
    ("groq", "llama-3.1-8b-instant"):                 ModelLimits(rpm=30,  rpd=14_400, tpm=6_000,  tpd=500_000),
    ("groq", "meta-llama/llama-4-scout-17b-16e-instruct"): ModelLimits(rpm=30, rpd=1_000, tpm=30_000, tpd=500_000),
    ("groq", "openai/gpt-oss-120b"):                  ModelLimits(rpm=30,  rpd=1_000,  tpm=8_000,  tpd=200_000),
    ("groq", "openai/gpt-oss-20b"):                   ModelLimits(rpm=30,  rpd=1_000,  tpm=8_000,  tpd=200_000),
    ("groq", "allam-2-7b"):                           ModelLimits(rpm=30,  rpd=7_000,  tpm=6_000,  tpd=500_000),
    # ── Groq Whisper (STT) ───────────────────────────────────────────
    ("groq", "whisper-large-v3"):                     ModelLimits(rpm=20,  rpd=2_000,  tpm=0,      tpd=0),
    ("groq", "whisper-large-v3-turbo"):               ModelLimits(rpm=20,  rpd=2_000,  tpm=0,      tpd=0),
    # ── Cerebras free (kept for re-enable when quota refills) ───────
    ("cerebras", "llama3.1-8b"):                      ModelLimits(rpm=30,  rpd=900,    tpm=60_000, tpd=1_000_000),
    ("cerebras", "qwen-3-235b-a22b-instruct-2507"):   ModelLimits(rpm=1,   rpd=900,    tpm=30_000, tpd=1_000_000),
}


def get_limits(provider: str, model: str) -> ModelLimits | None:
    """Return limits or None if unregistered (limiter becomes a no-op)."""
    return LIMITS.get((provider, model))
