from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.core.features import FeatureState


class FeatureEntry(BaseModel):
    """One key's effective state for the caller's tenant."""

    state: FeatureState
    note: str | None = None


class FeatureCatalogItem(BaseModel):
    key: str
    label_es: str
    scope: str | None = None


class FeatureStateWrite(BaseModel):
    state: FeatureState
    note: str | None = None
    #: Omit for the global default that every tenant inherits.
    tenant_id: UUID | None = None
