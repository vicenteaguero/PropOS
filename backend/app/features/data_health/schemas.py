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


class Finding(BaseModel):
    code: str
    severity: Severity
    title: str
    #: One line explaining what to do about it.
    hint: str
    count: int
    #: Where the broker fixes it. Relative to the role root, e.g. "crm?tab=personas".
    path: str | None = None


class DataHealth(BaseModel):
    findings: list[Finding]
    #: Total rows implicated, so a caller can badge without summing.
    total: int
