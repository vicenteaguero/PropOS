from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.rut import normalize_rut, validate_rut
from app.core.supabase.client import get_supabase_client
from app.features.compliance.service import ComplianceService
from app.features.compliance.schemas import ConsentEvidence, ConsentGrantRequest
from app.features.documents import storage
from app.features.documents.slugs import generate_slug
from app.features.notifications.email import service as email_service
from app.features.visitor_invitations.schemas import (
    InvitationCreate,
    InvitationPublicView,
    InvitationResponse,
    PrefilledData,
    PreflightResponse,
    SubmitPayload,
    SubmitResponse,
    UploadIdResponse,
)

TABLE = "visitor_invitations"
CONTACTS = "contacts"
PROPERTIES = "properties"
TENANTS = "tenants"
MEMBERSHIPS = "tenant_memberships"
DOCUMENTS = "documents"
DOC_VERSIONS = "document_versions"
INTERACTIONS = "interactions"
I_TARGETS = "interaction_targets"
I_PARTICIPANTS = "interaction_participants"

logger = get_logger("VISITOR_INV")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _invite_url(slug: str) -> str:
    base = (settings.app_base_url or "http://localhost:5173").rstrip("/")
    return f"{base}/invitacion/{slug}"


def _row_to_response(row: dict[str, Any]) -> InvitationResponse:
    return InvitationResponse(
        id=row["id"],
        tenant_id=row["tenant_id"],
        slug=row["slug"],
        email=row["email"],
        property_id=row["property_id"],
        mode=row["mode"],
        status=row["status"],
        expires_at=row["expires_at"],
        invite_url=_invite_url(row["slug"]),
        contact_id=row.get("contact_id"),
        user_id=row.get("user_id"),
        id_document_id=row.get("id_document_id"),
        created_at=row["created_at"],
        completed_at=row.get("completed_at"),
    )


def _dev_log_url(kind: str, url: str) -> None:
    if settings.app_env == "development":
        logger.info("dev_email_fallback", event_type="dev", kind=kind, url=url)


class VisitorInvitationService:
    # ---------- Admin ----------

    @staticmethod
    async def preflight(
        email: str,
        rut: str | None,
        admin_user_id: UUID,
        active_tenant_id: UUID,
    ) -> PreflightResponse:
        client = get_supabase_client()
        email_lower = email.strip().lower()
        rut_norm = normalize_rut(rut) if rut else None

        # tenants donde admin tiene membership
        memberships = (
            client.table(MEMBERSHIPS)
            .select("tenant_id")
            .eq("user_id", str(admin_user_id))
            .eq("is_active", True)
            .execute()
            .data
            or []
        )
        admin_tenant_ids = [m["tenant_id"] for m in memberships]

        contact_in_this = False
        contact_in_other = False
        other_slugs: list[str] = []

        if admin_tenant_ids:
            cq = client.table(CONTACTS).select("id, tenant_id").in_("tenant_id", admin_tenant_ids)
            cq = cq.or_(f"email.ilike.{email_lower}" + (f",rut.eq.{rut_norm}" if rut_norm else ""))
            rows = cq.execute().data or []
            for r in rows:
                if str(r["tenant_id"]) == str(active_tenant_id):
                    contact_in_this = True
                else:
                    contact_in_other = True
            other_tenant_ids = list({r["tenant_id"] for r in rows if str(r["tenant_id"]) != str(active_tenant_id)})
            if other_tenant_ids:
                tenants_rows = client.table(TENANTS).select("slug").in_("id", other_tenant_ids).execute().data or []
                other_slugs = [t["slug"] for t in tenants_rows]

        # auth.users via admin API
        auth_exists = False
        try:
            users_resp = client.auth.admin.list_users()
            users = getattr(users_resp, "users", None) or users_resp or []
            for u in users:
                u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                if u_email and u_email.lower() == email_lower:
                    auth_exists = True
                    break
        except Exception:  # noqa: BLE001
            pass

        warnings: list[str] = []
        if contact_in_this:
            warnings.append("Ya existe un contacto con este email/RUT en este tenant.")
        if contact_in_other and other_slugs:
            warnings.append(f"Existe en otro tenant: {', '.join(other_slugs)}.")
        if auth_exists:
            warnings.append("Email ya tiene cuenta de usuario.")

        return PreflightResponse(
            contact_exists_in_this_tenant=contact_in_this,
            contact_exists_in_other_tenant=contact_in_other,
            other_tenant_slugs=other_slugs,
            auth_user_exists=auth_exists,
            warnings=warnings,
        )

    @staticmethod
    async def create_invitation(
        payload: InvitationCreate,
        tenant_id: UUID,
        admin_user_id: UUID,
    ) -> InvitationResponse:
        client = get_supabase_client()

        prop = (
            client.table(PROPERTIES)
            .select("id, title")
            .eq("id", str(payload.property_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

        tenant_row = client.table(TENANTS).select("slug, name").eq("id", str(tenant_id)).single().execute().data
        brand = (tenant_row or {}).get("name") or "PropOS"

        slug = generate_slug(12)
        for _ in range(5):
            existing = client.table(TABLE).select("id").eq("slug", slug).execute().data
            if not existing:
                break
            slug = generate_slug(12)

        expires_at = (datetime.now(UTC) + timedelta(days=payload.expires_in_days)).isoformat()
        record = {
            "tenant_id": str(tenant_id),
            "slug": slug,
            "email": payload.email.strip().lower(),
            "property_id": str(payload.property_id),
            "mode": payload.mode,
            "status": "pending",
            "expires_at": expires_at,
            "created_by": str(admin_user_id),
            "last_email_sent_at": _now_iso(),
        }
        row = client.table(TABLE).insert(record).execute().data[0]

        url = _invite_url(slug)
        try:
            await email_service.send_visitor_invitation(
                to=row["email"],
                invite_url=url,
                property_title=prop["title"],
                brand=brand,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("visitor_invitation_email_failed", event_type="error", error=str(exc))
            _dev_log_url("visitor_invitation", url)

        logger.info(
            "visitor_invitation_created",
            event_type="write",
            invitation_id=row["id"],
            mode=payload.mode,
            tenant_id=str(tenant_id),
        )
        return _row_to_response(row)

    @staticmethod
    async def list_invitations(
        tenant_id: UUID,
        status_filter: str | None = None,
        property_id: UUID | None = None,
    ) -> list[InvitationResponse]:
        client = get_supabase_client()
        q = client.table(TABLE).select("*").eq("tenant_id", str(tenant_id)).order("created_at", desc=True)
        if status_filter:
            q = q.eq("status", status_filter)
        if property_id:
            q = q.eq("property_id", str(property_id))
        rows = q.execute().data or []
        return [_row_to_response(r) for r in rows]

    @staticmethod
    async def resend_invitation(invitation_id: UUID, tenant_id: UUID) -> InvitationResponse:
        client = get_supabase_client()
        row = (
            client.table(TABLE)
            .select("*")
            .eq("id", str(invitation_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not row:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if row["status"] in ("completed", "expired"):
            raise HTTPException(status_code=409, detail=f"Invitation is {row['status']}")
        prop = client.table(PROPERTIES).select("title").eq("id", row["property_id"]).single().execute().data
        tenant_row = client.table(TENANTS).select("name").eq("id", row["tenant_id"]).single().execute().data
        brand = (tenant_row or {}).get("name") or "PropOS"
        url = _invite_url(row["slug"])
        try:
            await email_service.send_visitor_invitation(
                to=row["email"],
                invite_url=url,
                property_title=(prop or {}).get("title", ""),
                brand=brand,
            )
        except Exception:  # noqa: BLE001
            _dev_log_url("visitor_invitation", url)
        client.table(TABLE).update({"last_email_sent_at": _now_iso()}).eq("id", row["id"]).execute()
        return _row_to_response(row)

    @staticmethod
    async def expire_invitation(invitation_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(TABLE).update({"status": "expired"}).eq("id", str(invitation_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()

    # ---------- Public ----------

    @staticmethod
    async def resolve_public(slug: str) -> InvitationPublicView:
        client = get_supabase_client()
        row = client.table(TABLE).select("*").eq("slug", slug).maybe_single().execute().data
        if not row:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        if row["status"] == "completed":
            raise HTTPException(status_code=410, detail="Invitación ya completada")
        if row["status"] == "expired":
            raise HTTPException(status_code=410, detail="Invitación expirada")
        expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        if expires < datetime.now(UTC):
            client.table(TABLE).update({"status": "expired"}).eq("id", row["id"]).execute()
            raise HTTPException(status_code=410, detail="Invitación expirada")

        prop = client.table(PROPERTIES).select("title, address").eq("id", row["property_id"]).single().execute().data
        tenant_row = client.table(TENANTS).select("slug").eq("id", row["tenant_id"]).single().execute().data

        # detect duplicates for path B/C
        email_lower = row["email"].lower()
        in_this = (
            client.table(CONTACTS)
            .select("id, full_name, email, phone, rut, address")
            .eq("tenant_id", row["tenant_id"])
            .ilike("email", email_lower)
            .limit(1)
            .execute()
            .data
        )
        in_other = []
        if not in_this:
            in_other = (
                client.table(CONTACTS)
                .select("full_name, email, phone, rut, address")
                .ilike("email", email_lower)
                .neq("tenant_id", row["tenant_id"])
                .limit(1)
                .execute()
                .data
            )

        prefilled: PrefilledData | None = None
        if in_this:
            c = in_this[0]
            prefilled = PrefilledData(
                full_name=c.get("full_name"), rut=c.get("rut"), phone=c.get("phone"), address=c.get("address")
            )
        elif in_other:
            c = in_other[0]
            prefilled = PrefilledData(
                full_name=c.get("full_name"), rut=c.get("rut"), phone=c.get("phone"), address=c.get("address")
            )

        # auth user existence
        existing_account = False
        try:
            users_resp = client.auth.admin.list_users()
            users = getattr(users_resp, "users", None) or users_resp or []
            for u in users:
                u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                if u_email and u_email.lower() == email_lower:
                    existing_account = True
                    break
        except Exception:  # noqa: BLE001
            pass

        # mark opened (idempotent first time)
        if row["status"] == "pending":
            client.table(TABLE).update({"status": "opened", "opened_at": _now_iso()}).eq("id", row["id"]).execute()

        return InvitationPublicView(
            slug=row["slug"],
            email=row["email"],
            property_title=(prop or {}).get("title") or "",
            property_address=(prop or {}).get("address"),
            tenant_slug=(tenant_row or {}).get("slug") or "",
            mode=row["mode"],
            existing_in_this_tenant=bool(in_this),
            existing_account=existing_account,
            prefilled=prefilled,
            has_id_document=bool(row.get("id_document_id")),
        )

    @staticmethod
    async def upload_id_pdf(slug: str, pdf_bytes: bytes) -> UploadIdResponse:
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Empty file")
        if len(pdf_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large (max 8MB)")

        client = get_supabase_client()
        inv = client.table(TABLE).select("*").eq("slug", slug).maybe_single().execute().data
        if not inv or inv["status"] not in ("pending", "opened"):
            raise HTTPException(status_code=410, detail="Invitación no disponible")

        sha = hashlib.sha256(pdf_bytes).hexdigest()
        document_id = str(uuid4())
        version_id = str(uuid4())
        raw = storage.raw_path(inv["tenant_id"], document_id, sha, "pdf")
        normalized = storage.normalized_path(inv["tenant_id"], document_id, sha)

        storage.upload_object(raw, pdf_bytes, "application/pdf")
        storage.upload_object(normalized, pdf_bytes, "application/pdf")

        client.table(DOCUMENTS).insert(
            {
                "id": document_id,
                "tenant_id": inv["tenant_id"],
                "display_name": "Cédula visitante",
                "kind": "PDF",
                "origin": "ANONYMOUS_PORTAL",
                "created_by": inv.get("created_by"),
            }
        ).execute()

        client.table(DOC_VERSIONS).insert(
            {
                "id": version_id,
                "document_id": document_id,
                "tenant_id": inv["tenant_id"],
                "version_number": 1,
                "raw_path": raw,
                "normalized_path": normalized,
                "size_bytes": len(pdf_bytes),
                "sha256": sha,
                "mime_type": "application/pdf",
                "original_filename": "cedula.pdf",
                "scan_status": "skipped",
                "ocr_status": "skipped",
                "ai_analysis_status": "skipped",
            }
        ).execute()

        client.table(DOCUMENTS).update({"current_version_id": version_id}).eq("id", document_id).execute()

        client.table(TABLE).update({"id_document_id": document_id}).eq("id", inv["id"]).execute()

        logger.info("visitor_id_pdf_uploaded", event_type="storage", invitation_id=inv["id"])
        return UploadIdResponse(document_id=UUID(document_id))

    @staticmethod
    async def submit_public(
        slug: str,
        payload: SubmitPayload,
        request_ip: str | None,
        user_agent: str | None,
    ) -> SubmitResponse:
        client = get_supabase_client()
        inv = client.table(TABLE).select("*").eq("slug", slug).maybe_single().execute().data
        if not inv or inv["status"] not in ("pending", "opened"):
            raise HTTPException(status_code=410, detail="Invitación no disponible")

        rut_norm = normalize_rut(payload.rut)
        if not validate_rut(rut_norm):
            raise HTTPException(status_code=400, detail="RUT inválido")
        if inv["mode"] == "auth_user" and not payload.password:
            raise HTTPException(status_code=400, detail="Password requerido para crear cuenta")
        if payload.password and len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Password debe tener al menos 8 caracteres")

        email_lower = inv["email"].lower()
        tenant_id = inv["tenant_id"]

        # locate auth user (if any)
        auth_user_id: str | None = None
        try:
            users_resp = client.auth.admin.list_users()
            users = getattr(users_resp, "users", None) or users_resp or []
            for u in users:
                u_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
                if u_email and u_email.lower() == email_lower:
                    auth_user_id = getattr(u, "id", None) or u.get("id")
                    break
        except Exception:  # noqa: BLE001
            pass

        # auth_user mode: create if missing
        requires_email_confirmation = False
        if inv["mode"] == "auth_user":
            if auth_user_id is None:
                try:
                    auth_resp = client.auth.admin.create_user(
                        {
                            "email": email_lower,
                            "password": payload.password,
                            "email_confirm": False,
                            "user_metadata": {"full_name": payload.full_name},
                        }
                    )
                    auth_user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
                    if not auth_user_id:
                        raise HTTPException(status_code=500, detail="Auth create returned no id")
                    requires_email_confirmation = True
                    # Trigger Supabase confirmation email via Resend SMTP.
                    try:
                        client.auth.admin.invite_user_by_email(
                            email_lower,
                            {"redirect_to": f"{(settings.app_base_url or '').rstrip('/')}/auth/setup"},
                        )
                    except Exception:  # noqa: BLE001
                        pass
                except HTTPException:
                    raise
                except Exception as exc:  # noqa: BLE001
                    raise HTTPException(status_code=400, detail=f"Auth create failed: {exc}") from exc
            # ensure profile + membership for buyer view
            VisitorInvitationService._upsert_profile_and_membership(
                client, auth_user_id, tenant_id, email_lower, payload, rut_norm
            )

        # contact upsert per-tenant
        contact_id = VisitorInvitationService._upsert_contact(client, tenant_id, email_lower, payload, rut_norm)

        # consent (always fresh)
        evidence = ConsentEvidence(
            ip=request_ip or payload.consent_evidence.ip,
            user_agent=user_agent or payload.consent_evidence.user_agent,
            text_shown=payload.consent_evidence.text_shown,
            channel=payload.consent_evidence.channel or "web",
        )
        await ComplianceService.record_consent(
            UUID(contact_id),
            UUID(tenant_id),
            ConsentGrantRequest(
                purposes=["operacional", "registro_visitante"],
                evidence=evidence,
                version="1.0",
            ),
        )

        # interaction VISIT
        interaction_id = str(uuid4())
        client.table(INTERACTIONS).insert(
            {
                "id": interaction_id,
                "tenant_id": tenant_id,
                "kind": "VISIT",
                "channel": "visitor_registration",
                "summary": f"Registro de visitante para {payload.full_name}",
                "occurred_at": _now_iso(),
            }
        ).execute()
        client.table(I_TARGETS).insert(
            {
                "tenant_id": tenant_id,
                "interaction_id": interaction_id,
                "property_id": inv["property_id"],
            }
        ).execute()
        client.table(I_PARTICIPANTS).insert(
            {
                "tenant_id": tenant_id,
                "interaction_id": interaction_id,
                "person_id": contact_id,
                "role": "visitor",
            }
        ).execute()

        # mark invitation completed
        client.table(TABLE).update(
            {
                "status": "completed",
                "completed_at": _now_iso(),
                "contact_id": contact_id,
                "user_id": auth_user_id,
            }
        ).eq("id", inv["id"]).execute()

        message = (
            "Registro completado. Revisa tu email para confirmar tu cuenta."
            if requires_email_confirmation
            else "Registro completado."
        )
        return SubmitResponse(
            contact_id=UUID(contact_id),
            user_id=UUID(auth_user_id) if auth_user_id else None,
            message=message,
            requires_email_confirmation=requires_email_confirmation,
        )

    # ---------- helpers ----------

    @staticmethod
    def _upsert_contact(
        client,
        tenant_id: str,
        email_lower: str,
        payload: SubmitPayload,
        rut_norm: str,
    ) -> str:
        existing = (
            client.table(CONTACTS)
            .select("id")
            .eq("tenant_id", tenant_id)
            .ilike("email", email_lower)
            .limit(1)
            .execute()
            .data
        )
        data: dict[str, Any] = {
            "full_name": payload.full_name,
            "email": email_lower,
            "phone": payload.phone,
            "type": "BUYER",
        }
        # contacts.rut + address may not exist in current schema — only set if column present.
        # safer: try update; if fails, retry without optional cols.
        opt = {"rut": rut_norm, "address": payload.address}
        try:
            if existing:
                cid = existing[0]["id"]
                client.table(CONTACTS).update({**data, **{k: v for k, v in opt.items() if v}}).eq("id", cid).execute()
                return cid
            ins = {"tenant_id": tenant_id, **data, **{k: v for k, v in opt.items() if v}}
            row = client.table(CONTACTS).insert(ins).execute().data[0]
            return row["id"]
        except Exception:  # noqa: BLE001
            # retry without optional cols if schema doesn't have them
            if existing:
                cid = existing[0]["id"]
                client.table(CONTACTS).update(data).eq("id", cid).execute()
                return cid
            ins = {"tenant_id": tenant_id, **data}
            row = client.table(CONTACTS).insert(ins).execute().data[0]
            return row["id"]

    @staticmethod
    def _upsert_profile_and_membership(
        client,
        user_id: str,
        tenant_id: str,
        email_lower: str,
        payload: SubmitPayload,
        rut_norm: str,
    ) -> None:
        # profile (idempotent on conflict id)
        existing_profile = client.table("profiles").select("id").eq("id", user_id).maybe_single().execute().data
        if not existing_profile:
            client.table("profiles").insert(
                {
                    "id": user_id,
                    "tenant_id": tenant_id,
                    "email": email_lower,
                    "full_name": payload.full_name,
                    "rut": rut_norm,
                    "role": "BUYER",
                    "admin_scope": [],
                    "is_active": True,
                }
            ).execute()
        # membership idempotent on (user_id, tenant_id)
        existing_m = (
            client.table(MEMBERSHIPS).select("user_id").eq("user_id", user_id).eq("tenant_id", tenant_id).execute().data
        )
        if not existing_m:
            client.table(MEMBERSHIPS).insert(
                {
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "role": "BUYER",
                    "admin_scope": [],
                    "is_dev_admin": False,
                    "is_active": True,
                }
            ).execute()
