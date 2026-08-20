"""Dev-only Postgres schema switch, driven by a request header.

Why a header and not an env var: `_shared_client` is `lru_cache`d, so
`SUPABASE_DB_SCHEMA` is read exactly once per process — changing it means a
restart, which is precisely the slow loop this removes. A per-request client
published on the existing `use_client` ContextVar reaches every feature without
any of them knowing about it.

Hard-gated to `APP_ENV=development`. In any other environment the middleware is
never installed, so the header is inert rather than merely ignored.

Note `propos_test` has no `profiles`, no memberships and no RLS (it is the
integration-test mirror), so switching to it exercises the backend, not the app.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.supabase.client import build_client, use_client

HEADER = "X-Db-Schema"

# An allowlist, not free text: the header reaches PostgREST as Accept-Profile,
# and an arbitrary value there is a way to probe schemas that are exposed but
# not meant for the app.
ALLOWED_SCHEMAS = frozenset({"public", "propos_test"})


class DevSchemaMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        schema = request.headers.get(HEADER)
        if not schema:
            return await call_next(request)
        if schema not in ALLOWED_SCHEMAS:
            return JSONResponse(
                status_code=400,
                content={"detail": f"unsupported schema: {schema}"},
            )
        with use_client(build_client(schema=schema)):
            return await call_next(request)
