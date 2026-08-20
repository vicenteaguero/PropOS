from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class EntityKind(StrEnum):
    """The record types a note (or any future picker) can point at.

    Mirrors the `note_target_kind` enum in the database, so the two cannot drift
    without a compile-time or migration failure making it obvious.
    """

    PROPERTY = "PROPERTY"
    CONTACT = "CONTACT"
    OPPORTUNITY = "OPPORTUNITY"
    EVENT = "EVENT"
    PROJECT = "PROJECT"
    PLACE = "PLACE"


class EntityHit(BaseModel):
    """One searchable record, reduced to what a picker needs to render it."""

    kind: EntityKind
    id: UUID
    label: str
    # Second line in the picker: a comuna, a date, a stage. Optional because not
    # every kind has a natural one.
    sub: str | None = None
