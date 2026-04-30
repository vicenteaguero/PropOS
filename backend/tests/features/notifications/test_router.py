from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

NOTIFICATIONS_PATH = "/api/v1/notifications"
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
async def test_subscribe(mock_client, client):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.insert.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "endpoint": "https://push.example.com/sub1",
        "p256dh": "test-p256dh-key",
        "auth_key": "test-auth-key",
    }

    response = await client.post(f"{NOTIFICATIONS_PATH}/subscribe", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "subscribed"
    assert response.json()["data"]["endpoint"] == "https://push.example.com/sub1"


@pytest.mark.asyncio
@patch("app.features.notifications.service.webpush")
@patch("app.features.notifications.service.get_supabase_client")
async def test_send_notification(mock_client, mock_webpush, client):
    mock_response = MagicMock()
    mock_response.data = [MOCK_SUBSCRIPTION]
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    payload = {
        "title": "Test Alert",
        "body": "Something happened",
    }

    response = await client.post(f"{NOTIFICATIONS_PATH}/send", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "sent"
    assert response.json()["count"] == 1
    mock_webpush.assert_called_once()


@pytest.mark.asyncio
@patch("app.features.notifications.service.webpush")
@patch("app.features.notifications.service.get_supabase_client")
async def test_send_notification_no_subscriptions(mock_client, mock_webpush, client):
    mock_response = MagicMock()
    mock_response.data = []
    table_mock = MagicMock()
    table_mock.select.return_value = table_mock
    table_mock.eq.return_value = table_mock
    table_mock.execute.return_value = mock_response
    mock_client.return_value.table.return_value = table_mock

    payload = {"body": "No one will see this"}

    response = await client.post(f"{NOTIFICATIONS_PATH}/send", json=payload)

    assert response.status_code == 200
    assert response.json()["count"] == 0
    mock_webpush.assert_not_called()
