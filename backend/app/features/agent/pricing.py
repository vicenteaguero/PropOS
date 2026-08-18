"""Token prices per (provider, model), in USD per 1M tokens.

Same contract as ``rate_limits.py``: values come from the provider's public
pricing page, not guesswork, and must be updated whenever the model or the
plan changes. An unregistered model returns ``None`` — the caller writes NULL
rather than pretending the turn was free.

Note on the free tier: Groq bills $0 there. These are list prices, so the
number is the *nominal* cost of the same traffic on a paid plan. That is what
the cost dashboard and the daily budget need in order to be useful before the
plan switch, not after.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPrice:
    input_usd_per_mtok: float
    output_usd_per_mtok: float


# (provider, model) -> ModelPrice. Audio models (Whisper) are billed per hour
# of audio, not per token, so they are deliberately absent.
PRICES: dict[tuple[str, str], ModelPrice] = {
    ("groq", "llama-3.3-70b-versatile"): ModelPrice(0.59, 0.79),
    ("groq", "llama-3.1-8b-instant"): ModelPrice(0.05, 0.08),
    ("groq", "openai/gpt-oss-120b"): ModelPrice(0.15, 0.75),
    ("groq", "openai/gpt-oss-20b"): ModelPrice(0.10, 0.50),
    ("groq", "qwen/qwen3-32b"): ModelPrice(0.29, 0.59),
}


def get_price(provider: str, model: str) -> ModelPrice | None:
    return PRICES.get((provider, model))


def cost_usd(provider: str, model: str, tokens_in: int, tokens_out: int) -> float | None:
    """Nominal USD cost of one call, or None when the model is unpriced."""
    price = get_price(provider, model)
    if price is None:
        return None
    return (tokens_in / 1_000_000) * price.input_usd_per_mtok + (tokens_out / 1_000_000) * price.output_usd_per_mtok


def cost_cents_exact(provider: str, model: str, tokens_in: int, tokens_out: int) -> float | None:
    """Cost in cents WITHOUT rounding.

    `agent_messages.cost_cents` is an INT and a single turn costs ~0.07c, so
    rounding per row floors every turn to zero — which is exactly why the cost
    dashboard read $0. Callers round on a running total instead (see
    `chat._cost_cents_for_turn`).
    """
    usd = cost_usd(provider, model, tokens_in, tokens_out)
    return None if usd is None else usd * 100
