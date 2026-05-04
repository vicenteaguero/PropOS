"""Deterministic post-processing of classifier output.

Fixes that don't justify prompt tokens because they're catchable with
regex / arithmetic:

- ``dedupe_actions``: drops ``add_note`` when the same turn already has
  a structured write action (model sometimes emits both).
- ``normalize_rut``: when the user dictated a RUT with self-correction
  ("7 millones... no espera, 18 millones..."), the model occasionally
  concatenates both attempts. Extract the last valid 7-9-digit run.
- ``expand_money_units``: classifier sometimes returns the bare number
  the user said ("180 lucas") without expanding the slang. We multiply
  ``amount`` / ``price_clp`` / ``hoa_clp`` / ``budget`` by 1_000 / 1_000_000
  when the source text mentions ``lucas`` / ``palos`` near that number.
"""

from __future__ import annotations

import re

from app.features.anita.classifier import Action

# Intents that imply a structured write to a domain entity. If any of
# them is present, ``add_note`` is redundant.
_STRUCTURED_WRITES = {
    "log_interaction", "create_person", "create_task", "log_transaction",
    "create_organization", "create_property", "create_campaign",
}

# Match the final verifier token (digit or K) of a RUT-like string.
_RUT_TAIL_RE = re.compile(r"[-‐]?\s*([0-9Kk])\s*$")

# Money fields that should be in CLP integer pesos.
_MONEY_FIELDS = ("amount", "price_clp", "hoa_clp", "budget")


_VAGUE_NOTE_MIN_CHARS = 20

# Phrases the user uses to *defer* providing real content. When any of
# these appear, treat the request as ambiguous instead of guessing a note.
_DEFERRAL_PHRASES = (
    "después te cuento", "después te explico", "después te digo",
    "déjalo así", "te cuento bien", "después te paso",
)


def _is_deferral(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in _DEFERRAL_PHRASES)


def dedupe_actions(actions: list[Action], user_text: str = "") -> list[Action]:
    """Drop or downgrade ``add_note`` entries that aren't actionable.

    1. If the turn already has a structured write, ``add_note`` is redundant
       — drop it.
    2. If the body is too short, or the user's message contains a deferral
       phrase ("después te cuento"), promote to ``ambiguous``.
    """
    has_write = any(a.intent in _STRUCTURED_WRITES for a in actions)
    if has_write:
        actions = [a for a in actions if a.intent != "add_note"]

    deferral = _is_deferral(user_text)
    out: list[Action] = []
    for a in actions:
        if a.intent == "add_note":
            body = str(a.fields.get("body") or a.fields.get("summary") or "").strip()
            if deferral or len(body) < _VAGUE_NOTE_MIN_CHARS:
                out.append(Action(
                    intent="ambiguous",
                    fields={"reason": "sin contenido accionable"},
                    raw=a.raw,
                ))
                continue
        out.append(a)
    return out


def normalize_rut(action: Action) -> None:
    """Re-parse the ``rut`` field on the action, in place.

    Handles two failure modes:
      - "7.18.573.892-K" → "18.573.892-K" (auto-correction concatenated by
        the model — the leading digit is the discarded first attempt).
      - "18573892-K"     → "18.573.892-K" (no dot separators).

    Heuristic: Chilean RUTs are 7-8 digits + 1 verifier. If we get more
    than 8 digits in the body, keep only the last 8 — that's the most
    recent (corrected) attempt.
    """
    raw = action.fields.get("rut")
    if not isinstance(raw, str):
        return
    s = raw.strip()
    m = _RUT_TAIL_RE.search(s)
    if not m:
        return
    verifier = m.group(1).upper()
    body = s[: m.start()]
    digits = re.sub(r"\D", "", body)
    if len(digits) < 7:
        return
    if len(digits) > 8:
        digits = digits[-8:]
    rev = digits[::-1]
    grouped = ".".join(rev[i:i + 3] for i in range(0, len(rev), 3))[::-1]
    action.fields["rut"] = f"{grouped}-{verifier}"


_LUCAS_RE = re.compile(r"(\d[\d.,]*)\s*(lucas|palos|millones?|mil)\b", re.IGNORECASE)
_MULTIPLIER = {"lucas": 1_000, "mil": 1_000, "palos": 1_000_000,
               "millon": 1_000_000, "millones": 1_000_000, "millón": 1_000_000}


def _expand_value(num_text: str, unit: str) -> int | None:
    try:
        n = int(float(num_text.replace(".", "").replace(",", "")))
    except ValueError:
        return None
    mult = _MULTIPLIER.get(unit.lower(), 1)
    return n * mult


def expand_money_units(action: Action, user_text: str) -> None:
    """Multiply small money values by 1_000 / 1_000_000 when the source
    text used Chilean slang nearby. Idempotent: only fires when the
    classifier returned a value too small to be a real CLP price.

    Example: classifier returns ``hoa_clp=180``, user said "180 lucas
    mensuales" → corrected to 180_000.
    """
    found = list(_LUCAS_RE.finditer(user_text))
    if not found:
        return

    for field in _MONEY_FIELDS:
        v = action.fields.get(field)
        if not isinstance(v, int):
            continue
        # Pick the slang occurrence whose number matches our value.
        for m in found:
            try:
                base = int(float(m.group(1).replace(".", "").replace(",", "")))
            except ValueError:
                continue
            if base != v:
                continue
            expanded = _expand_value(m.group(1), m.group(2))
            if expanded and expanded != v:
                action.fields[field] = expanded
                break
