from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

NoteTargetKind = Literal["PROPERTY", "CONTACT", "OPPORTUNITY", "EVENT", "PROJECT", "PLACE"]


class NoteTargetInput(BaseModel):
    kind: NoteTargetKind
    row_id: UUID


class NoteTarget(BaseModel):
    """A resolved link: what the note points at, and what that record is called.

    `id` is the `note_targets` row id, or the literal "legacy" for a note that
    still only carries the old `target_table`/`target_row_id` pair (the agent
    writes those). Callers use it to unlink either kind through one route.
    """

    id: str
    kind: NoteTargetKind
    row_id: UUID
    target_table: str
    label: str
    # False when the record could not be found -- the label is a placeholder.
    resolved: bool = True


class NoteAttachment(BaseModel):
    """A photo or voice memo. Every URL is signed and short-lived."""

    id: UUID
    media_file_id: UUID
    role: Literal["PHOTO", "AUDIO"]
    position: int
    url: str
    # WebP renditions; absent for audio, and equal to `url` when the derivative
    # was never generated.
    thumb_url: str | None = None
    card_url: str | None = None
    title: str | None = None
    created_at: datetime | None = None


class NoteBase(BaseModel):
    body: str
    # Kept for compatibility: the agent's note writer still fills this pair, and
    # it mirrors the first entry of `targets`.
    target_table: str | None = None
    target_row_id: UUID | None = None


class NoteCreate(NoteBase):
    targets: list[NoteTargetInput] = []


class NoteUpdate(BaseModel):
    body: str | None = None


class NoteResponse(NoteBase):
    id: UUID
    tenant_id: UUID
    source: str
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    targets: list[NoteTarget] = []
    attachments: list[NoteAttachment] = []

    model_config = {"from_attributes": True}
