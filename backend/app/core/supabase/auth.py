from __future__ import annotations

from supabase import Client

from app.core.supabase.client import get_supabase_client

PROFILES_TABLE = "profiles"


def verify_token(token: str) -> dict:
    client = get_supabase_client()
    response = client.auth.get_user(token)
    return response.user


def get_user_profile(user_id: str, client: Client | None = None) -> dict:
    """Return profile merged with the active tenant_membership fields.

    `is_dev_admin` and `view` now live only on tenant_memberships. We resolve
    the active membership by `profiles.tenant_id` (kept in sync by
    `activate_tenant`) and merge the two fields into the returned dict for
    backwards compatibility with `get_current_user`.
    """
    if client is None:
        client = get_supabase_client()
    response = client.table(PROFILES_TABLE).select("*").eq("id", user_id).single().execute()
    profile = response.data
    if not profile:
        return profile

    tenant_id = profile.get("tenant_id")
    if tenant_id:
        m = (
            client.table("tenant_memberships")
            .select("is_dev_admin, view")
            .eq("user_id", user_id)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        if m and m.data:
            profile["is_dev_admin"] = bool(m.data.get("is_dev_admin"))
            profile["view"] = m.data.get("view") or "agent"
        else:
            profile["is_dev_admin"] = False
            profile["view"] = "agent"
    else:
        profile["is_dev_admin"] = False
        profile["view"] = "agent"
    return profile
