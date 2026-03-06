"""Test WebPushException error handling in send_push."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from pywebpush import WebPushException

from app.features.notifications.service import send_push

MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

MOCK_SUBSCRIPTION = {
    "id": str(uuid4()),
    "user_id": "11111111-1111-1111-1111-111111111111",
    "tenant_id": MOCK_TENANT_ID,
    "endpoint": "https://push.example.com/sub1",
    "p256dh": "test-key",
    "auth_key": "test-auth",
}


@pytest.mark.asyncio
@patch("app.features.notifications.service.webpush")
@patch("app.features.notifications.service.get_supabase_client")
async def test_send_push_webpush_exception(mock_client, mock_webpush):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    mock_webpush.side_effect = WebPushException("Push failed")

    count = await send_push(
        tenant_id=MOCK_TENANT_ID,
        title="Test",
        body="Will fail",
    )

    assert count == 0
    mock_webpush.assert_called_once()
