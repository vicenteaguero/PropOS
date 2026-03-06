import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def mock_user():
    return {
        "id": USER_ID,
        "role": "ADMIN",
        "tenant_id": TENANT_ID,
        "full_name": "Test Admin",
    }


@pytest.fixture
def app(mock_user):
    application = create_app()
    application.dependency_overrides[get_current_user] = lambda: mock_user
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
