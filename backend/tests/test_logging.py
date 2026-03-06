"""Tests for logging configuration and formatters."""

import structlog

from app.core.logging.formatters import DEFAULT_EMOJI, EVENT_EMOJI_MAP, get_emoji
from app.core.logging.logger import _add_emoji, _add_scope, configure_logging, get_logger


def test_get_emoji_known_event():
    assert get_emoji("auth") == EVENT_EMOJI_MAP["auth"]


def test_get_emoji_unknown_event():
    assert get_emoji("nonexistent") == DEFAULT_EMOJI


def test_add_emoji_processor():
    event_dict = {"event": "test message", "event_type": "auth"}
    result = _add_emoji(None, "info", event_dict)
    assert EVENT_EMOJI_MAP["auth"] in result["event"]
    assert "event_type" not in result


def test_add_emoji_default_event_type():
    event_dict = {"event": "no type"}
    result = _add_emoji(None, "info", event_dict)
    assert DEFAULT_EMOJI in result["event"]


def test_add_scope_processor():
    event_dict = {"event": "test message", "scope": "TEST"}
    result = _add_scope(None, "info", event_dict)
    assert "[TEST]" in result["event"]
    assert "scope" not in result


def test_add_scope_default():
    event_dict = {"event": "test message"}
    result = _add_scope(None, "info", event_dict)
    assert "[APP]" in result["event"]


def test_configure_logging():
    configure_logging("info")
    logger = structlog.get_logger()
    assert logger is not None


def test_configure_logging_default():
    configure_logging()
    logger = structlog.get_logger()
    assert logger is not None


def test_get_logger():
    logger = get_logger("TEST_SCOPE")
    assert logger is not None
