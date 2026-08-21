"""The OpenAPI schema must build.

`DELETE /v1/visitor-invitations/{id}` carried `response_class=None` with the
type error silenced, and FastAPI raised "A response class is needed to generate
OpenAPI" while building the schema. One bad route takes the WHOLE document
down, so `/openapi.json` returned 500 and `/docs` was dead for every endpoint —
and nothing failed until somebody opened the docs, because no test built it.
"""

from __future__ import annotations

from fastapi.openapi.utils import get_openapi

from app.main import app


def test_the_schema_builds_at_all():
    schema = get_openapi(title="PropOS", version="test", routes=app.routes)
    assert schema["paths"]


def test_every_registered_route_reaches_the_document():
    """A route that silently fails to serialise is the failure mode above."""
    schema = get_openapi(title="PropOS", version="test", routes=app.routes)
    documented = set(schema["paths"])
    missing = {
        route.path
        for route in app.routes
        if getattr(route, "include_in_schema", False) and getattr(route, "methods", None)
    } - documented
    assert not missing, f"routes missing from the schema: {sorted(missing)}"


def test_the_204_delete_that_broke_it_is_documented():
    schema = get_openapi(title="PropOS", version="test", routes=app.routes)
    path = schema["paths"]["/api/v1/visitor-invitations/{invitation_id}"]
    assert "204" in path["delete"]["responses"]
