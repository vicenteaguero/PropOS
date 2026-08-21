import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.dependencies import get_current_user
from app.core.supabase.auth_cache import reset_auth_caches
from app.main import create_app

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_ID = "11111111-1111-1111-1111-111111111111"


@pytest.fixture(autouse=True)
def _reset_auth_caches():
    """Identity caching is process-global, so it leaks across tests.

    Both sides of the yield on purpose: a test that warms an entry must not
    poison its successor, and a test that inherits a warm entry must not see
    zero calls where it asserted one. Without this,
    `test_supabase_auth.py::test_verify_token` becomes order-dependent — it
    verifies the literal "test-token", and so does anything else that copies
    the pattern.
    """
    reset_auth_caches()
    yield
    reset_auth_caches()


@pytest.fixture
def mock_user():
    return {
        "id": USER_ID,
        "role": "ADMIN",
        "tenant_id": TENANT_ID,
        "full_name": "Test Admin",
        "admin_scope": [],
        "is_dev_admin": True,
        "view": "admin-dev",
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
