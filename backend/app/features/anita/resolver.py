"""Local fuzzy matching: classifier entities → tenant IDs.

Zero LLM calls. Uses ``rapidfuzz`` to match the names the LLM extracted
("Juan Pérez", "Apoquindo") against the in-memory tenant snapshot.

Output:
- ``ResolvedFields``: every entity either matched (with id+score) or
  marked ``ambiguous`` (multiple plausible candidates) / ``not_found``.
- The dispatcher decides whether to proceed (single match), ask the user
  (ambiguous), or skip (not found, depends on intent).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from rapidfuzz import fuzz, process

from app.features.anita.context import TenantSnapshot

MIN_SCORE = 70           # below this → "not_found"
AMBIGUITY_GAP = 8        # if top1 - top2 < gap → ambiguous


@dataclass
class Candidate:
    id: UUID
    label: str
    score: float


@dataclass
class FieldResolution:
    raw: str
    resolved_id: UUID | None = None
    candidates: list[Candidate] = field(default_factory=list)
    status: str = "ok"  # ok | ambiguous | not_found


@dataclass
class ResolvedFields:
    """Every entity-style field annotated. `extras` carries the rest of
    classifier output (kind, duration_min, amount_clp, summary, etc.)."""
    person: FieldResolution | None = None
    property: FieldResolution | None = None
    project: FieldResolution | None = None
    org: FieldResolution | None = None
    extras: dict[str, Any] = field(default_factory=dict)
    is_ambiguous: bool = False
    ambiguity_summary: list[dict[str, Any]] = field(default_factory=list)


def _resolve_one(query: str, choices: list[dict[str, Any]], label_keys: tuple[str, ...]) -> FieldResolution:
    """Run rapidfuzz against `choices`, returning a `FieldResolution`."""
    if not query or not choices:
        return FieldResolution(raw=query, status="not_found")

    # Build label list — first non-empty label_key wins per row.
    pairs: list[tuple[str, dict[str, Any]]] = []
    for row in choices:
        for k in label_keys:
            v = row.get(k)
            if v:
                pairs.append((str(v), row))
                break

    if not pairs:
        return FieldResolution(raw=query, status="not_found")

    labels = [p[0] for p in pairs]
    scored = process.extract(query, labels, scorer=fuzz.WRatio, limit=5)

    cands = [
        Candidate(
            id=UUID(pairs[idx][1]["id"]),
            label=labels[idx],
            score=score,
        )
        for label, score, idx in scored
        if score >= MIN_SCORE
    ]

    if not cands:
        return FieldResolution(raw=query, status="not_found")

    if len(cands) == 1 or cands[0].score - cands[1].score >= AMBIGUITY_GAP:
        return FieldResolution(raw=query, resolved_id=cands[0].id, candidates=cands, status="ok")

    return FieldResolution(raw=query, candidates=cands, status="ambiguous")


CREATE_INTENTS = {"create_person", "create_organization"}


def resolve(fields: dict[str, Any], snapshot: TenantSnapshot, *, intent: str = "") -> ResolvedFields:
    """Annotate classifier fields with snapshot IDs.

    For ``create_*`` intents the person/org name is the NEW entity — we
    don't try to match it against existing rows, just keep the raw text
    so the dispatcher can write it to the proposal payload.
    """
    resolved = ResolvedFields()
    leftover = dict(fields)
    is_create = intent in CREATE_INTENTS

    if (q := leftover.pop("person", None)):
        if is_create and intent == "create_person":
            resolved.person = FieldResolution(raw=str(q), status="not_found")
        else:
            resolved.person = _resolve_one(str(q), snapshot.people, ("full_name",))
    if (q := leftover.pop("property", None)):
        resolved.property = _resolve_one(str(q), snapshot.properties, ("title", "address"))
    if (q := leftover.pop("project", None)):
        resolved.project = _resolve_one(str(q), snapshot.projects, ("name",))
    if (q := leftover.pop("org", None)):
        if is_create and intent == "create_organization":
            resolved.org = FieldResolution(raw=str(q), status="not_found")
        else:
            resolved.org = _resolve_one(str(q), snapshot.organizations, ("name",))

    resolved.extras = leftover

    # Aggregate ambiguity. Any field that didn't match cleanly bubbles up.
    for name, fr in (("person", resolved.person), ("property", resolved.property),
                     ("project", resolved.project), ("org", resolved.org)):
        if fr is None:
            continue
        if fr.status == "ambiguous":
            resolved.is_ambiguous = True
            resolved.ambiguity_summary.append({
                "field": name,
                "raw": fr.raw,
                "candidates": [
                    {"id": str(c.id), "label": c.label, "score": int(c.score)}
                    for c in fr.candidates
                ],
            })
    return resolved
