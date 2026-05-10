from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ConsentEvidence(BaseModel):
    ip: str | None = None
    user_agent: str | None = None
    text_shown: str | None = None
    channel: str | None = None


class ConsentGrantRequest(BaseModel):
    purposes: list[str]
    evidence: ConsentEvidence
    version: str = "1.0"


class ConsentRevokeRequest(BaseModel):
    purposes: list[str] | None = None


class ConsentState(BaseModel):
    version: str | None = None
    granted_at: datetime | None = None
    purposes: list[str] = []
    evidence: ConsentEvidence | None = None
    revoked_at: datetime | None = None
    blocked_at: datetime | None = None


class SubjectExport(BaseModel):
    subject_id: UUID
    tenant_id: UUID
    generated_at: datetime
    contact: dict[str, Any]
    consent: ConsentState | None = None
    interactions: list[dict[str, Any]] = []
    interaction_targets: list[dict[str, Any]] = []
    notes: list[dict[str, Any]] = []
    tasks: list[dict[str, Any]] = []
    media_files: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
