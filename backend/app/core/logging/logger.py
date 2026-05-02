from __future__ import annotations

import logging
from typing import Any

import structlog

from app.core.logging.formatters import get_emoji


def _add_emoji(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    event_type = event_dict.pop("event_type", "request")
    emoji = get_emoji(event_type)
    event_dict["event"] = f"{emoji} {event_dict.get('event', '')}"
    return event_dict


def _add_scope(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    scope = event_dict.pop("scope", "APP")
    event_dict["event"] = f"[{scope}] {event_dict.get('event', '')}"
    return event_dict


def configure_logging(log_level: str = "debug") -> None:
    numeric_level = getattr(logging, log_level.upper(), logging.DEBUG)
    logging.basicConfig(
        format="%(message)s",
        level=numeric_level,
    )
    for noisy in (
        "hpack",
        "hpack.hpack",
        "hpack.table",
        "h2",
        "h2.connection",
        "h2.stream",
        "httpx",
        "httpcore",
        "httpcore.http2",
        "httpcore.connection",
        "watchfiles",
        "watchfiles.main",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _add_scope,
            _add_emoji,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(scope: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(scope=scope)
