from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from starlette.requests import Request
from starlette.responses import Response

from app.core.config.constants import SKIP_MIDDLEWARE_PATHS


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in SKIP_MIDDLEWARE_PATHS:
            return await call_next(request)

        tenant_id = getattr(request.state, "tenant_id", None)
        if tenant_id is None:
            request.state.tenant_id = None

        return await call_next(request)
