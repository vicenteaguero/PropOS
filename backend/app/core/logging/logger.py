from __future__ import annotations

import logging
from typing import Any

import structlog

from app.core.config.settings import settings
from app.core.logging.formatters import get_emoji

# structlog level name -> Cloud Logging severity. Anything unmapped falls back
# to DEFAULT, which is what every line used to be: unfilterable, unalertable.
# https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
_GCP_SEVERITY = {
    "critical": "CRITICAL",
    "exception": "ERROR",
    "error": "ERROR",
    "warn": "WARNING",
    "warning": "WARNING",
    "info": "INFO",
    "debug": "DEBUG",
    "notset": "DEFAULT",
}


def _add_emoji(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    event_type = event_dict.pop("event_type", "request")
    emoji = get_emoji(event_type)
    event_dict["event"] = f"{emoji} {event_dict.get('event', '')}"
    return event_dict


def _add_scope(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    scope = event_dict.pop("scope", "APP")
    event_dict["event"] = f"[{scope}] {event_dict.get('event', '')}"
    return event_dict


def _add_gcp_severity(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """Stamp the `severity` key Cloud Logging reads to classify a JSON line.

    Without it every line lands as DEFAULT, so `severity>=ERROR` matches
    nothing and no log-based metric or alert can be built on top.
    """
    level = str(event_dict.get("level", "")).lower()
    event_dict["severity"] = _GCP_SEVERITY.get(level, "DEFAULT")
    return event_dict


def configure_logging(log_level: str = "debug", json_logs: bool | None = None) -> None:
    """Configure structlog + stdlib logging.

    Development renders the coloured console format. Production renders JSON,
    because Cloud Logging parses a JSON line into `jsonPayload` with a real
    severity, and treats anything else as `textPayload` at DEFAULT — ANSI escape
    codes included. `json_logs` overrides the `APP_ENV` decision (tests).

    stdlib records are routed through the same renderer via `ProcessorFormatter`
    so an unhandled 500 logged by uvicorn is as filterable as our own events.
    """
    if json_logs is None:
        json_logs = settings.app_env == "production"

    numeric_level = getattr(logging, log_level.upper(), logging.DEBUG)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if json_logs:
        # `event_type` stays a top-level key instead of being folded into an
        # emoji, so `jsonPayload.event_type="job"` is queryable. `event` is
        # renamed to `message` because that is the field Cloud Logging shows as
        # the summary line.
        render_chain: list[Any] = [
            _add_scope,
            _add_gcp_severity,
            structlog.processors.format_exc_info,
            structlog.processors.EventRenamer("message"),
            structlog.processors.JSONRenderer(),
        ]
    else:
        render_chain = [_add_scope, _add_emoji, structlog.dev.ConsoleRenderer()]

    structlog.configure(
        processors=[*shared_processors, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler()
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=shared_processors,
            processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, *render_chain],
        )
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(numeric_level)

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


def get_logger(scope: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(scope=scope)
