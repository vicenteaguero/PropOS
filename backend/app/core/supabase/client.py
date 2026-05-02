from __future__ import annotations

import os
from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions as ClientOptions

from app.core.config.settings import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Service-role Supabase client.

    Honors `SUPABASE_DB_SCHEMA` env var (default: `public`) so integration
    tests can route every table call to a mirror schema (e.g. `propos_test`)
    without touching production data. Same DB, different schema — PostgREST
    sends `Accept-Profile`/`Content-Profile` headers per the option.
    """
    schema = os.environ.get("SUPABASE_DB_SCHEMA", "public")
    options = ClientOptions(schema=schema)
    return create_client(  # pragma: no cover
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=options,
    )
