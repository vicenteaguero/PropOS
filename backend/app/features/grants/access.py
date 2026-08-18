"""Shared authorization primitives for `property_grants`.

`LANDOWNER` (Dueño) is the one role that lives outside the brokerage: it has no
tenant-wide reach at all, only the properties an admin explicitly granted it.
Every route it can call narrows its result set through these helpers, so the
rule lives in one place instead of being re-derived per feature.

Everyone else who clears a router's `require_role` gate is internal staff and
sees the tenant normally.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.core.dependencies import FORBIDDEN_MESSAGE
from app.core.supabase.client import get_supabase_client

GRANTS_TABLE = "property_grants"

# Roles whose reads must be intersected with their grants.
#
# BUYER ("Interesado") is deliberately NOT here — audit R3, P2-11 / N8. The
# plumbing for it exists: `user_view` has a `buyer` value, `property_grants.view`
# accepts it, and `sharing/service.py` already whitelists a `buyer` audience in
# `audience_caps`. What does not exist is a product surface: `/buyer` renders an
# empty dashboard, there is no per-property screen, and `docs/roles.md` states
# the design has no buyer-facing property browsing at all.
#
# Adding the role here would open a read path nothing calls and nobody reviews.
# When the buyer screen ships, the change is: add "BUYER" to this tuple, add it
# to the reader role tuples in `documents/router.py` and `interactions/router.py`,
# and key the audience projection off the caller's view instead of hardcoding
# "owner" in `interactions/schemas.py`.
GRANT_SCOPED_ROLES = ("LANDOWNER",)


def forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=FORBIDDEN_MESSAGE,
    )


def is_grant_scoped(current_user: dict[str, Any]) -> bool:
    """True when this caller may only see what its grants cover."""
    return current_user.get("role") in GRANT_SCOPED_ROLES


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
    """Staff pass through; a grant-scoped caller must target a granted property.

    An unfiltered listing would hand the whole tenant catalogue to an external
    user, so a missing `property_id` is rejected rather than widened.
    """
    if not is_grant_scoped(current_user):
        return
    if property_id is None:
        raise forbidden()
    if str(property_id) not in granted_property_ids(UUID(current_user["id"]), tenant_id):
        raise forbidden()
