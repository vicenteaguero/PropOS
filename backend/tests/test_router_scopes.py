"""Every gated section of the API declares the scope its UI already enforces.

Audit R3, P2-02: the shell gates 12 scopes in `frontend/src/app/router.tsx`, but
only 6 routers verified one server-side. An admin narrowed to, say, `finanzas`
still reached the whole CRM over HTTP. This module pins the map so a new router
cannot quietly ship without its scope.

Semantics worth remembering: an empty `admin_scope` means FULL access, so these
gates only ever bite users who were deliberately narrowed.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user, require_scope
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"

# path prefix (under /api/v1) -> scope string used by the frontend
SCOPE_BY_PREFIX = {
    "/contacts": "crm",
    "/interactions": "crm",
    "/opportunities": "crm",
    "/organizations": "crm",
    "/campaigns": "crm",
    "/transactions": "finanzas",
    "/finance": "finanzas",
    "/tasks": "productividad",
    "/events": "productividad",
    "/notes": "productividad",
    "/reminders": "productividad",
    "/workflows": "workflows",
    "/documents": "documents",
    "/client-chat": "inbox",
}


def _declared_scopes(route) -> set[str]:
    """Scope strings closed over by the `require_scope` dependencies on a route."""
    scopes: set[str] = set()
    for dep in getattr(route, "dependencies", []):
        fn = dep.dependency
        if getattr(fn, "__qualname__", "").startswith("require_scope"):
            for cell in fn.__closure__ or ():
                try:
                    value = cell.cell_contents
                except ValueError:
                    continue
                if isinstance(value, str):
                    scopes.add(value)
    return scopes


@pytest.mark.parametrize(("prefix", "scope"), sorted(SCOPE_BY_PREFIX.items()))
def test_every_route_under_prefix_declares_its_scope(prefix, scope):
    routes = [route for route in create_app().routes if getattr(route, "path", "").startswith(f"/api/v1{prefix}")]
    assert routes, f"no routes mounted under {prefix}"
    for route in routes:
        assert _declared_scopes(route) == {scope}, route.path


# One real GET per section, since a few routers have no route at the bare prefix.
PROBE_PATH = {
    "/contacts": "/api/v1/contacts",
    "/interactions": "/api/v1/interactions",
    "/opportunities": "/api/v1/opportunities",
    "/organizations": "/api/v1/organizations",
    "/campaigns": "/api/v1/campaigns",
    "/transactions": "/api/v1/transactions",
    "/finance": "/api/v1/finance/summary",
    "/tasks": "/api/v1/tasks",
    "/events": "/api/v1/events",
    "/notes": "/api/v1/notes",
    "/reminders": "/api/v1/reminders",
    "/workflows": "/api/v1/workflows",
    "/documents": "/api/v1/documents",
    "/client-chat": "/api/v1/client-chat/conversations",
}


@pytest.mark.asyncio
@pytest.mark.parametrize("prefix", sorted(SCOPE_BY_PREFIX))
async def test_admin_narrowed_to_another_scope_is_refused(prefix):
    """A full ADMIN whose `admin_scope` excludes this section gets a 403."""
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_ID,
        "role": "ADMIN",
        "tenant_id": TENANT_ID,
        "full_name": "Scoped Admin",
        # A scope that exists in the shell but is not the one under test.
        "admin_scope": ["analytics"],
        "is_dev_admin": False,
        "view": "admin",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(PROBE_PATH[prefix])
    assert resp.status_code == 403, prefix


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", sorted(set(SCOPE_BY_PREFIX.values())))
async def test_empty_admin_scope_still_means_full_access(scope):
    """Empty scope must never read as "no access" — it is the unrestricted case.

    Asserted against the dependency itself: going over HTTP would sail past the
    gate and into a live Supabase call.
    """
    checker = require_scope(scope)
    user = {
        "id": USER_ID,
        "role": "ADMIN",
        "tenant_id": TENANT_ID,
        "full_name": "Full Admin",
        "admin_scope": [],
        "is_dev_admin": True,
        "view": "admin-dev",
    }
    assert await checker(user) is user
