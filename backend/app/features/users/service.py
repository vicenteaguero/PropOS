from __future__ import annotations

import secrets
from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.rut import normalize_rut, validate_rut
from app.core.supabase.client import get_supabase_client

PROFILES_TABLE = "profiles"
USER_EMAILS_TABLE = "user_emails"
MEMBERSHIPS_TABLE = "tenant_memberships"

logger = get_logger("USERS")


# ---------- helpers ----------


def _strip_full_name(parts: dict) -> dict:
    """`full_name` is a generated column; never sent on insert/update."""
    parts.pop("full_name", None)
    return parts


def _validate_rut_or_raise(rut: str | None) -> str | None:
    if not rut:
        return None
    normalized = normalize_rut(rut)
    if not validate_rut(normalized):
        raise HTTPException(status_code=422, detail=f"RUT inválido: {rut}")
    return normalized


def _first_membership_snapshot(memberships: list[dict]) -> dict:
    """Pick the first membership as the profile snapshot (default tenant)."""
    if not memberships:
        return {}
    m = memberships[0]
    return {
        "tenant_id": str(m["tenant_id"]),
        "role": m.get("role") or "ADMIN",
        "admin_scope": m.get("admin_scope") or [],
        "is_dev_admin": bool(m.get("is_dev_admin", False)),
        "view": m.get("view") or "admin",
    }


def _membership_rows(user_id: str, memberships: list[dict]) -> list[dict]:
    rows = []
    for m in memberships:
        rows.append(
            {
                "user_id": user_id,
                "tenant_id": str(m["tenant_id"]),
                "role": m.get("role") or "ADMIN",
                "admin_scope": m.get("admin_scope") or [],
                "is_dev_admin": bool(m.get("is_dev_admin", False)),
                "view": m.get("view") or "admin",
            }
        )
    return rows


def _email_rows(user_id: str, tenant_id: str, primary: str, additionals: list[dict]) -> list[dict]:
    rows = [
        {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "email": primary,
            "label": "primary",
            "purpose": "all",
            "is_primary": True,
        }
    ]
    for extra in additionals or []:
        rows.append(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "email": str(extra["email"] if isinstance(extra, dict) else extra.email).lower(),
                "label": (extra["label"] if isinstance(extra, dict) else extra.label),
                "purpose": (extra["purpose"] if isinstance(extra, dict) else extra.purpose.value)
                if (isinstance(extra, dict) and extra.get("purpose")) or not isinstance(extra, dict)
                else "all",
                "is_primary": False,
            }
        )
    return rows


# ---------- service ----------


class UserService:
    @staticmethod
    async def list_users(
        tenant_id: UUID,
        *,
        role: str | None = None,
        view: str | None = None,
        search: str | None = None,
    ) -> list[dict]:
        client = get_supabase_client()
        q = client.table(PROFILES_TABLE).select("*").eq("tenant_id", str(tenant_id))
        if role:
            q = q.eq("role", role)
        if view:
            q = q.eq("view", view)
        if search:
            # OR across email / full_name / rut
            term = f"%{search}%"
            q = q.or_(f"email.ilike.{term},full_name.ilike.{term},rut.ilike.{term}")
        return q.execute().data

    @staticmethod
    async def get_user(user_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        resp = (
            client.table(PROFILES_TABLE)
            .select("*")
            .eq("id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
        )
        return resp.data

    @staticmethod
    async def get_user_detail(user_id: UUID) -> dict:
        """Detail used by admin user-detail page: profile + memberships + emails + grants."""
        client = get_supabase_client()
        profile = client.table(PROFILES_TABLE).select("*").eq("id", str(user_id)).single().execute().data
        memberships = (
            client.table(MEMBERSHIPS_TABLE)
            .select("*, tenants(id, name, slug)")
            .eq("user_id", str(user_id))
            .execute()
            .data
        )
        emails = (
            client.table(USER_EMAILS_TABLE)
            .select("*")
            .eq("user_id", str(user_id))
            .order("is_primary", desc=True)
            .execute()
            .data
        )
        grants = (
            client.table("property_grants")
            .select("*, properties(id, title, address)")
            .eq("user_id", str(user_id))
            .execute()
            .data
        )
        return {**profile, "memberships": memberships, "user_emails": emails, "grants": grants}

    @staticmethod
    async def get_me(user_id: UUID) -> dict:
        client = get_supabase_client()
        return client.table(PROFILES_TABLE).select("*").eq("id", str(user_id)).single().execute().data

    @staticmethod
    async def create_user(payload: Any, tenant_id: UUID) -> dict:
        """Direct create with password (legacy + fake-email path).

        If ``payload.memberships`` is empty, defaults to a single membership in
        ``tenant_id`` with the legacy role/admin_scope.
        """
        client = get_supabase_client()
        email = payload.email.strip().lower()
        rut = _validate_rut_or_raise(payload.rut)

        existing = client.table(PROFILES_TABLE).select("id").ilike("email", email).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="Email ya registrado")
        if rut:
            existing_rut = client.table(PROFILES_TABLE).select("id").eq("rut", rut).limit(1).execute()
            if existing_rut.data:
                raise HTTPException(status_code=409, detail="RUT ya registrado")

        password = payload.password or secrets.token_urlsafe(16)
        try:
            auth_resp = client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": payload.full_name or ""},
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Auth create failed: {exc}") from exc

        user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
        if not user_id:
            raise HTTPException(status_code=500, detail="Auth user creation returned no id")

        memberships_spec = [m.model_dump() if hasattr(m, "model_dump") else m for m in (payload.memberships or [])]
        if not memberships_spec:
            memberships_spec = [
                {
                    "tenant_id": tenant_id,
                    "role": payload.role.value if hasattr(payload.role, "value") else payload.role,
                    "admin_scope": [],
                    "is_dev_admin": False,
                    "view": "agent",
                }
            ]

        snapshot = _first_membership_snapshot(memberships_spec)
        profile = _strip_full_name(
            {
                "id": user_id,
                "tenant_id": snapshot["tenant_id"],
                "first_name": payload.first_name,
                "middle_name": payload.middle_name,
                "paternal_surname": payload.paternal_surname,
                "maternal_surname": payload.maternal_surname,
                "role": snapshot["role"],
                "admin_scope": snapshot["admin_scope"],
                "is_active": payload.is_active,
                "email": email,
                "rut": rut,
            }
        )
        try:
            resp = client.table(PROFILES_TABLE).insert(profile).execute()
        except Exception as exc:
            try:
                client.auth.admin.delete_user(user_id)
            except Exception:  # noqa: BLE001
                pass
            raise HTTPException(status_code=400, detail=f"Profile insert failed: {exc}") from exc

        try:
            client.table(MEMBERSHIPS_TABLE).insert(_membership_rows(user_id, memberships_spec)).execute()
        except Exception as exc:
            logger.error("memberships_insert_failed", event_type="error", user_id=user_id, error=str(exc))

        try:
            client.table(USER_EMAILS_TABLE).insert(
                _email_rows(user_id, snapshot["tenant_id"], email, payload.additional_emails or [])
            ).execute()
        except Exception as exc:
            logger.error("user_emails_insert_failed", event_type="error", user_id=user_id, error=str(exc))

        return resp.data[0]

    @staticmethod
    async def invite_user(payload: Any, tenant_id: UUID) -> dict:
        """Magic-invite path (Supabase mails the link)."""
        client = get_supabase_client()
        email = payload.primary_email.strip().lower()
        rut = _validate_rut_or_raise(payload.rut)

        existing = client.table(PROFILES_TABLE).select("id").ilike("email", email).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="Email ya registrado")
        if rut:
            existing_rut = client.table(PROFILES_TABLE).select("id").eq("rut", rut).limit(1).execute()
            if existing_rut.data:
                raise HTTPException(status_code=409, detail="RUT ya registrado")

        try:
            auth_resp = client.auth.admin.invite_user_by_email(
                email,
                {"redirect_to": f"{settings.app_base_url}/auth/setup"},
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invite failed: {exc}") from exc

        user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
        if not user_id:
            raise HTTPException(status_code=500, detail="Invite returned no user id")

        memberships_spec = [m.model_dump() if hasattr(m, "model_dump") else m for m in (payload.memberships or [])]
        if not memberships_spec:
            memberships_spec = [
                {
                    "tenant_id": tenant_id,
                    "role": "ADMIN",
                    "admin_scope": [],
                    "is_dev_admin": False,
                    "view": "admin",
                }
            ]

        snapshot = _first_membership_snapshot(memberships_spec)
        profile = _strip_full_name(
            {
                "id": user_id,
                "tenant_id": snapshot["tenant_id"],
                "first_name": payload.first_name,
                "middle_name": payload.middle_name,
                "paternal_surname": payload.paternal_surname,
                "maternal_surname": payload.maternal_surname,
                "role": snapshot["role"],
                "admin_scope": snapshot["admin_scope"],
                "is_active": True,
                "email": email,
                "rut": rut,
            }
        )
        try:
            resp = client.table(PROFILES_TABLE).insert(profile).execute()
        except Exception as exc:
            try:
                client.auth.admin.delete_user(user_id)
            except Exception:  # noqa: BLE001
                pass
            raise HTTPException(status_code=400, detail=f"Profile insert failed: {exc}") from exc

        try:
            client.table(MEMBERSHIPS_TABLE).insert(_membership_rows(user_id, memberships_spec)).execute()
        except Exception as exc:
            logger.error("memberships_insert_failed", event_type="error", user_id=user_id, error=str(exc))

        try:
            client.table(USER_EMAILS_TABLE).insert(
                _email_rows(user_id, snapshot["tenant_id"], email, payload.additional_emails or [])
            ).execute()
        except Exception as exc:
            logger.error("user_emails_insert_failed", event_type="error", user_id=user_id, error=str(exc))

        return resp.data[0]

    @staticmethod
    async def update_user(user_id: UUID, payload: Any, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "role" in data and data["role"] is not None:
            data["role"] = data["role"].value
        if "view" in data and data["view"] is not None:
            data["view"] = data["view"].value if hasattr(data["view"], "value") else data["view"]
        if "rut" in data:
            data["rut"] = _validate_rut_or_raise(data["rut"])
        _strip_full_name(data)

        # is_dev_admin and view live only on tenant_memberships; strip from profile patch.
        membership_patch = {k: data.pop(k) for k in ("is_dev_admin", "view") if k in data}
        membership_patch.update({k: data[k] for k in ("role", "admin_scope") if k in data})

        # Update profile snapshot (role/admin_scope still mirrored for legacy RLS).
        resp = (
            client.table(PROFILES_TABLE).update(data).eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        )
        if membership_patch:
            client.table(MEMBERSHIPS_TABLE).update(membership_patch).eq("user_id", str(user_id)).eq(
                "tenant_id", str(tenant_id)
            ).execute()
        return resp.data[0] if resp.data else {}

    @staticmethod
    async def update_avatar(user_id: UUID, avatar_url: str | None) -> dict:
        client = get_supabase_client()
        resp = client.table(PROFILES_TABLE).update({"avatar_url": avatar_url}).eq("id", str(user_id)).execute()
        return resp.data[0]

    @staticmethod
    async def delete_user(user_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(PROFILES_TABLE).delete().eq("id", str(user_id)).eq("tenant_id", str(tenant_id)).execute()
        try:
            client.auth.admin.delete_user(str(user_id))
        except Exception:  # noqa: BLE001
            pass

    # ---------- security / lifecycle ----------

    @staticmethod
    async def reset_password(user_id: UUID) -> dict:
        """Send recovery email via Supabase SMTP."""
        client = get_supabase_client()
        profile = client.table(PROFILES_TABLE).select("email").eq("id", str(user_id)).single().execute().data
        if not profile or not profile.get("email"):
            raise HTTPException(status_code=404, detail="User has no email on file")
        try:
            client.auth.admin.generate_link(
                {
                    "type": "recovery",
                    "email": profile["email"],
                    "options": {"redirect_to": f"{settings.app_base_url}/auth/recovery"},
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"reset_password failed: {exc}") from exc
        return {"sent_to": profile["email"]}

    @staticmethod
    async def resend_invite(user_id: UUID) -> dict:
        client = get_supabase_client()
        profile = client.table(PROFILES_TABLE).select("email").eq("id", str(user_id)).single().execute().data
        if not profile or not profile.get("email"):
            raise HTTPException(status_code=404, detail="User has no email on file")
        try:
            client.auth.admin.generate_link(
                {
                    "type": "invite",
                    "email": profile["email"],
                    "options": {"redirect_to": f"{settings.app_base_url}/auth/setup"},
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"resend_invite failed: {exc}") from exc
        return {"sent_to": profile["email"]}

    @staticmethod
    async def set_password(user_id: UUID, new_password: str) -> dict:
        client = get_supabase_client()
        try:
            client.auth.admin.update_user_by_id(str(user_id), {"password": new_password})
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"set_password failed: {exc}") from exc
        return {"ok": True}

    @staticmethod
    async def disable_user(user_id: UUID) -> dict:
        client = get_supabase_client()
        try:
            client.auth.admin.update_user_by_id(str(user_id), {"ban_duration": "876000h"})
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"disable failed: {exc}") from exc
        client.table(PROFILES_TABLE).update({"is_active": False}).eq("id", str(user_id)).execute()
        return {"ok": True}

    @staticmethod
    async def enable_user(user_id: UUID) -> dict:
        client = get_supabase_client()
        try:
            client.auth.admin.update_user_by_id(str(user_id), {"ban_duration": "none"})
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"enable failed: {exc}") from exc
        client.table(PROFILES_TABLE).update({"is_active": True}).eq("id", str(user_id)).execute()
        return {"ok": True}

    @staticmethod
    async def impersonate(user_id: UUID) -> dict:
        """Generate a one-shot magic link for an admin to log in as the user.

        Admin opens the returned URL in incognito. Auditable.
        """
        client = get_supabase_client()
        profile = client.table(PROFILES_TABLE).select("email").eq("id", str(user_id)).single().execute().data
        if not profile or not profile.get("email"):
            raise HTTPException(status_code=404, detail="User has no email on file")
        try:
            link = client.auth.admin.generate_link(
                {
                    "type": "magiclink",
                    "email": profile["email"],
                    "options": {"redirect_to": f"{settings.app_base_url}/"},
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"impersonate failed: {exc}") from exc
        action_link = None
        try:
            action_link = link.properties.action_link  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass
        return {"magic_link": action_link or "", "expires_in_seconds": 3600}


class UserEmailService:
    @staticmethod
    async def list_for_user(user_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        resp = (
            client.table(USER_EMAILS_TABLE)
            .select("*")
            .eq("user_id", str(user_id))
            .eq("tenant_id", str(tenant_id))
            .order("is_primary", desc=True)
            .order("created_at")
            .execute()
        )
        return resp.data

    @staticmethod
    async def add(user_id: UUID, tenant_id: UUID, payload: Any) -> dict:
        client = get_supabase_client()
        email = str(payload.email).lower()
        existing = client.table(USER_EMAILS_TABLE).select("id").ilike("email", email).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="Email ya registrado")

        if payload.is_primary:
            client.table(USER_EMAILS_TABLE).update({"is_primary": False}).eq("user_id", str(user_id)).eq(
                "is_primary", True
            ).execute()

        row = {
            "tenant_id": str(tenant_id),
            "user_id": str(user_id),
            "email": email,
            "label": payload.label,
            "purpose": payload.purpose.value,
            "is_primary": payload.is_primary,
        }
        resp = client.table(USER_EMAILS_TABLE).insert(row).execute()
        return resp.data[0]

    @staticmethod
    async def delete(email_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(USER_EMAILS_TABLE).delete().eq("id", str(email_id)).eq("tenant_id", str(tenant_id)).execute()
