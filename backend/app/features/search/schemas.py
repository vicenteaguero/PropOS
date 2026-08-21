from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class EntityKind(StrEnum):
    """What global search can find.

    The first six mirror the `note_target_kind` enum in the database, so a
    picker and a note target cannot drift apart without a migration making it
    obvious. MESSAGE is search-only: a message is not something a note can
    point at, but "the conversation where they mentioned the bodega" is the
    thing a broker most often needs to get back to.
    """

    PROPERTY = "PROPERTY"
    CONTACT = "CONTACT"
    OPPORTUNITY = "OPPORTUNITY"
    EVENT = "EVENT"
    PROJECT = "PROJECT"
    PLACE = "PLACE"
    MESSAGE = "MESSAGE"


class EntityHit(BaseModel):
    """One searchable record, reduced to what a picker needs to render it."""

    kind: EntityKind
    id: UUID
    label: str
    # Second line in the picker: a comuna, a date, a stage. Optional because not
    # every kind has a natural one.
    sub: str | None = None
