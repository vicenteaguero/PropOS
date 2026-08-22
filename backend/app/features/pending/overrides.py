"""Whitelist for the corrections a reviewer applies before accepting.

`PendingService.accept_proposal` used to merge the request body straight into
the payload with `payload.update(overrides)` — no schema, no filter — and that
payload goes on to be the row an executor inserts. Any key at all reached the
database: `tenant_id`, `id`, `created_by`, a column belonging to some other
table. The proposal queue is reviewed by a human precisely because the model is
not trusted; letting the review itself write arbitrary columns undid that.

What a correction is allowed to touch is already declared, per intent, in
`intent_registry.IntentSpec` — the same declaration the classifier extracts
against. This turns that declaration into the boundary.
"""

from __future__ import annotations

from typing import Any

from app.features.agent.intent_registry import REGISTRY, IntentSpec

#: Longest value we will carry into a text column from a review. Generous for a
#: note or a description, far short of anything worth calling an upload.
_MAX_TEXT = 2000


class OverrideError(ValueError):
    """A correction named a field the intent does not declare."""


def _spec_by_proposal_kind() -> dict[str, IntentSpec]:
    """`propose_create_task` → its spec. Proposals are keyed by the tool name."""
    return {spec.proposal_kind: spec for spec in REGISTRY.values()}


SPEC_BY_PROPOSAL_KIND: dict[str, IntentSpec] = _spec_by_proposal_kind()


def sanitize_overrides(kind: str, overrides: dict[str, Any] | None) -> dict[str, Any]:
    """Keep only the fields `kind` declares, normalised through its aliases.

    Raises rather than dropping silently. A reviewer who corrects a field and
    sees "Aceptar" succeed is entitled to believe the correction was saved; a
    quiet drop makes the queue lie about the one thing it exists to do.
    """
    if not overrides:
        return {}

    spec = SPEC_BY_PROPOSAL_KIND.get(kind)
    if spec is None:
        # No declaration means no way to know what is safe here.
        raise OverrideError(f"No se puede corregir una propuesta de tipo '{kind}'.")

    allowed = set(spec.all_fields)
    clean: dict[str, Any] = {}
    rejected: list[str] = []

    for raw_key, value in overrides.items():
        key = spec.aliases.get(raw_key, raw_key)
        if key not in allowed:
            rejected.append(raw_key)
            continue
        # An emptied field means "leave it as it was", not "write empty". The
        # executors treat a present-but-blank column as a real write.
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        if isinstance(value, str):
            clean[key] = value.strip()[:_MAX_TEXT]
        elif isinstance(value, int | float | bool | list):
            clean[key] = value
        else:
            rejected.append(raw_key)

    if rejected:
        raise OverrideError("Campos que no pertenecen a esta acción: " + ", ".join(sorted(rejected)))

    return clean
