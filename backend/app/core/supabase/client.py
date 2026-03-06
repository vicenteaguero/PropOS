from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config.settings import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    return create_client(  # pragma: no cover
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
