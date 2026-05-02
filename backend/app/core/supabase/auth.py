from __future__ import annotations

from supabase import Client

from app.core.supabase.client import get_supabase_client

PROFILES_TABLE = "profiles"


def verify_token(token: str) -> dict:
    client = get_supabase_client()
    response = client.auth.get_user(token)
    return response.user


def get_user_profile(user_id: str, client: Client | None = None) -> dict:
    if client is None:
        client = get_supabase_client()
    response = client.table(PROFILES_TABLE).select("*").eq("id", user_id).single().execute()
    return response.data
