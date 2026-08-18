"""Access rules for the document repository.

Two populations reach these routes:

* **Staff** (``ADMIN`` / ``AGENT`` / ``CONTENT``) run the repository and see the
  whole tenant catalogue.
* **LANDOWNER** is an external user. Its only entry point is the owner PWA,
  which shows the documents of the properties the user holds a
  ``property_grants`` row for. Every route a landowner can reach is therefore
  narrowed here to those properties.

``BUYER`` and any other role have no document access at all — the router-level
``require_role`` keeps them out before these helpers run.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.core.dependencies import FORBIDDEN_MESSAGE
from app.core.supabase.client import get_supabase_client

STAFF_ROLES = ("ADMIN", "AGENT", "CONTENT")

GRANTS_TABLE = "property_grants"
ASSIGNMENTS_TABLE = "document_assignments"


def is_staff(current_user: dict[str, Any]) -> bool:
    return current_user.get("role") in STAFF_ROLES


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=FORBIDDEN_MESSAGE,
    )


def granted_property_ids(user_id: UUID, tenant_id: UUID) -> set[str]:
    """Property ids the user holds a grant for inside the active tenant."""
    client = get_supabase_client()
    rows = (
        client.table(GRANTS_TABLE)
        .select("property_id")
        .eq("user_id", str(user_id))
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
        or []
    )
    return {row["property_id"] for row in rows if row.get("property_id")}


def assert_property_granted(
    current_user: dict[str, Any],
    tenant_id: UUID,
    property_id: UUID | None,
) -> None:
    """Staff pass through; a landowner must target a property it was granted.

    An unfiltered listing would hand the whole tenant catalogue to an external
    user, so a missing ``property_id`` is rejected rather than widened.
    """
    if is_staff(current_user):
        return
    if property_id is None:
        raise _forbidden()
    if str(property_id) not in granted_property_ids(UUID(current_user["id"]), tenant_id):
        raise _forbidden()


def assert_document_granted(
    current_user: dict[str, Any],
    tenant_id: UUID,
    document_id: UUID,
) -> None:
    """Staff pass through; a landowner reaches a document only via assignments.

    A document is visible when at least one of its ``document_assignments``
    points at a property the user was granted.
    """
    if is_staff(current_user):
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
        raise _forbidden()
    if not assigned & granted_property_ids(UUID(current_user["id"]), tenant_id):
        raise _forbidden()
