"""Test app lifespan (startup logging)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import lifespan


@pytest.mark.asyncio
@patch("app.main.logger")
@patch("app.main.configure_logging")
async def test_lifespan_calls_configure_and_logs(mock_configure, mock_logger):
    mock_app = MagicMock()

    async with lifespan(mock_app):
        pass

    mock_configure.assert_called_once()
    mock_logger.info.assert_called_once_with("PropOS API started", event_type="start")
