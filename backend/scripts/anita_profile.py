"""Profile Anita's classifier on a single prompt.

Usage:
  poetry run python scripts/anita_profile.py "loguea visita con Juan Pérez 30 min"

Prints exact token usage + parsed result. Use to iterate on the system
prompt: shrink, re-run, measure.
"""

from __future__ import annotations

import asyncio
import sys

from app.features.anita.classifier import classify


async def main(text: str) -> None:
    result = await classify(text)

    print(f"input  : {text}")
    print(f"raw    : {result.raw}")
    print(f"intent : {result.intent}")
    print(f"fields : {result.fields}")
    print()
    total = result.tokens_in + result.tokens_out
    print(f"tokens : in={result.tokens_in:>4}  out={result.tokens_out:>4}  total={total}")
    rl_tokens_remaining = result.headers.get("x-ratelimit-remaining-tokens")
    rl_reset = result.headers.get("x-ratelimit-reset-tokens")
    if rl_tokens_remaining:
        print(f"groq   : remaining_tokens={rl_tokens_remaining}  reset_in={rl_reset}")


if __name__ == "__main__":
    text = " ".join(sys.argv[1:]) or "loguea visita con Juan Pérez en Apoquindo, 30 min"
    asyncio.run(main(text))
