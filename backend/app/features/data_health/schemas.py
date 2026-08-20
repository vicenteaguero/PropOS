from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class Severity(StrEnum):
    """How much a finding costs if ignored.

    `WARNING` is work the broker chose not to do yet; `ERROR` is a row that will
    misbehave — a deal with no property cannot be reported on, a landowner with
    no property is a contact nobody can act on.
    """

    ERROR = "ERROR"
    WARNING = "WARNING"


class FindingEntity(StrEnum):
    """The list a finding is fixed in."""

    CONTACTS = "contacts"
    PROPERTIES = "properties"
    OPPORTUNITIES = "opportunities"


class Finding(BaseModel):
    code: str
    severity: Severity
    title: str
    #: One line explaining what to do about it.
    hint: str
    count: int
    #: Which list the broker fixes it in. The frontend owns the route: this used
    #: to be a literal path string ("crm?tab=personas") shipped from the backend,
    #: so renaming a section silently broke every "arreglar" link.
    entity: FindingEntity | None = None


class DataHealth(BaseModel):
    findings: list[Finding]
    #: Total rows implicated, so a caller can badge without summing.
    total: int
