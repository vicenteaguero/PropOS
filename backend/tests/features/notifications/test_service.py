from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.features.notifications.service import (
    get_subscriptions,
    save_subscription,
    send_push,
)

MOCK_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"

MOCK_SUBSCRIPTION = {
    "id": str(uuid4()),
    "user_id": MOCK_USER_ID,
    "tenant_id": MOCK_TENANT_ID,
    "endpoint": "https://push.example.com/sub1",
    "p256dh": "test-p256dh-key",
    "auth_key": "test-auth-key",
}


@pytest.mark.asyncio
@patch("app.features.notifications.service.get_supabase_client")
async def test_save_subscription(mock_client):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    result = await save_subscription(
        user_id=MOCK_USER_ID,
        tenant_id=MOCK_TENANT_ID,
        endpoint="https://push.example.com/sub1",
        p256dh="test-p256dh-key",
        auth_key="test-auth-key",
    )

    assert result["endpoint"] == "https://push.example.com/sub1"
    mock_client.return_value.table.assert_called_with("notification_subscriptions")


@pytest.mark.asyncio
@patch("app.features.notifications.service.get_supabase_client")
async def test_get_subscriptions_all(mock_client):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    result = await get_subscriptions(MOCK_TENANT_ID)

    assert len(result) == 1
    assert result[0]["user_id"] == MOCK_USER_ID


@pytest.mark.asyncio
@patch("app.features.notifications.service.get_supabase_client")
async def test_get_subscriptions_by_user(mock_client):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    result = await get_subscriptions(MOCK_TENANT_ID, user_id=MOCK_USER_ID)

    assert len(result) == 1


@pytest.mark.asyncio
@patch("app.features.notifications.service.webpush")
@patch("app.features.notifications.service.get_supabase_client")
async def test_send_push_success(mock_client, mock_webpush):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    count = await send_push(
        tenant_id=MOCK_TENANT_ID,
        title="Test",
        body="Hello",
    )

    assert count == 1
    mock_webpush.assert_called_once()


@pytest.mark.asyncio
@patch("app.features.notifications.service.webpush")
@patch("app.features.notifications.service.get_supabase_client")
async def test_send_push_empty(mock_client, mock_webpush):
    mock_response = MagicMock()
    mock_response.data = []
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    count = await send_push(
        tenant_id=MOCK_TENANT_ID,
        title="Test",
        body="Nobody here",
    )

    assert count == 0
    mock_webpush.assert_not_called()
