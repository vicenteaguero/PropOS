from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

PROFILES_TABLE = "profiles"

logger = get_logger("USERS")


class UserService:
    @staticmethod
    async def list_users(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        logger.info(
            "listing",
            event_type="query",
            tenant_id=str(tenant_id),
        )
        response = client.table(PROFILES_TABLE).select("*").eq("tenant_id", str(tenant_id)).execute()
        return response.data

    @staticmethod
    async def get_user(user_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching",
            event_type="query",
            user_id=str(user_id),
        )
        response = (
            client.table(PROFILES_TABLE)
            .select("*")
            .eq("id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return response.data

    @staticmethod
    async def get_me(user_id: UUID) -> dict:
        client = get_supabase_client()
        logger.info(
            "fetching_self",
            event_type="query",
            user_id=str(user_id),
        )
        response = client.table(PROFILES_TABLE).select("*").eq("id", str(user_id)).single().execute()
        return response.data

    @staticmethod
    async def create_user(payload: object, tenant_id: UUID) -> dict:
        import secrets

        from fastapi import HTTPException

        client = get_supabase_client()
        email = payload.email.strip().lower()
        rut = payload.rut.strip() if payload.rut else None

        # Pre-check uniqueness (friendlier error than DB constraint).
        existing_email = (
            client.table(PROFILES_TABLE).select("id").ilike("email", email).limit(1).execute()
        )
        if existing_email.data:
            raise HTTPException(status_code=409, detail="Email ya registrado")
        if rut:
            existing_rut = (
                client.table(PROFILES_TABLE).select("id").eq("rut", rut).limit(1).execute()
            )
            if existing_rut.data:
                raise HTTPException(status_code=409, detail="RUT ya registrado")

        password = payload.password or secrets.token_urlsafe(16)
        try:
            auth_resp = client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": payload.full_name},
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Auth create failed: {exc}") from exc

        user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
        if not user_id:
            raise HTTPException(status_code=500, detail="Auth user creation returned no id")

        profile = {
            "id": user_id,
            "tenant_id": str(tenant_id),
            "full_name": payload.full_name,
            "role": payload.role.value,
            "is_active": payload.is_active,
            "email": email,
            "rut": rut,
        }
        logger.info("creating", event_type="write", tenant_id=str(tenant_id))
        try:
            response = client.table(PROFILES_TABLE).insert(profile).execute()
        except Exception as exc:
            # Rollback auth user on profile failure.
            try:
                client.auth.admin.delete_user(user_id)
            except Exception:  # noqa: BLE001
                pass
            raise HTTPException(status_code=400, detail=f"Profile insert failed: {exc}") from exc
        return response.data[0]

    @staticmethod
    async def update_user(user_id: UUID, payload: object, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "role" in data and data["role"] is not None:
            data["role"] = data["role"].value
        logger.info(
            "updating",
            event_type="write",
            user_id=str(user_id),
        )
        response = (
            client.table(PROFILES_TABLE).update(data).eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_user(user_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        logger.info(
            "deleting",
            event_type="delete",
            user_id=str(user_id),
        )
        (client.table(PROFILES_TABLE).delete().eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute())
