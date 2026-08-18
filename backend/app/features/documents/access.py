"""Access rules for the document repository.

Two populations reach these routes:

* **Staff** (`ADMIN` / `AGENT` / `CONTENT`) run the repository and see the whole
  tenant catalogue.
* **LANDOWNER** is an external user. Its only entry point is the owner PWA,
  which shows the documents of the properties the user holds a
  `property_grants` row for. Every route a landowner can reach is therefore
  narrowed to those properties.

`BUYER` and any other role have no document access at all — the router-level
`require_role` keeps them out before these helpers run. The grant primitives
themselves live in `grants/access.py`, shared with the owner's visits feed.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.grants.access import (
    assert_property_granted,
    forbidden,
    granted_property_ids,
    is_grant_scoped,
)

__all__ = ["STAFF_ROLES", "assert_document_granted", "assert_property_granted"]

STAFF_ROLES = ("ADMIN", "AGENT", "CONTENT")

ASSIGNMENTS_TABLE = "document_assignments"


def assert_document_granted(
    current_user: dict[str, Any],
    tenant_id: UUID,
    document_id: UUID,
) -> None:
    """Staff pass through; a landowner reaches a document only via assignments.

    A document is visible when at least one of its `document_assignments`
    points at a property the user was granted.
    """
    if not is_grant_scoped(current_user):
        return
    client = get_supabase_client()
    rows = (
        client.table(ASSIGNMENTS_TABLE)
        .select("property_id")
        .eq("document_id", str(document_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
        or []
    )
    assigned = {row["property_id"] for row in rows if row.get("property_id")}
    if not assigned:
        raise forbidden()
    if not assigned & granted_property_ids(UUID(current_user["id"]), tenant_id):
        raise forbidden()
