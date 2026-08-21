"""Request timing, as a plain ASGI middleware.

Written against the raw ASGI interface rather than Starlette's
`BaseHTTPMiddleware`, which wraps every request in an anyio task group and a
pair of memory object streams to give itself a request/response API it does not
need here. That machinery costs per request, and it also buffers the response
stream — which matters because the agent streams its turns over SSE.

All this needs is the status code and a clock, both of which the raw protocol
hands over directly.
"""

from __future__ import annotations

import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging.logger import get_logger

logger = get_logger("HTTP")


class TimingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            # In `finally` so a handler that raises is still timed. Without it
            # the slowest requests — the ones that blew up — were the only ones
            # that never appeared in the log.
            duration_ms = round((time.perf_counter() - start) * 1000)
            logger.info(
                f"{status} in {duration_ms}ms",
                event_type="request",
                method=scope.get("method", ""),
                path=scope.get("path", ""),
            )
