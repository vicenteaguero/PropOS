"""Seed admin users + sample data demonstrating the multi-tenancy + grants flow.

Creates:
- 4 admin profiles (Vicente DEV uc.cl, Vicente plain, Ana, Jaime).
- 1 owner test profile (LANDOWNER role, view=owner).
- 9 memberships (4 admins × 2 tenants + owner × 1 tenant).
- 9 user_emails (4 primaries + 4 additionals on Vicente DEV + 1 owner primary).
- 1 sample property in Anaida.
- 1 property_grant (owner test → sample property, caps view-only).
- 1 sample document linked to property with audience_caps unlocked for owner.

Idempotent: skips users whose email already exists.

Usage:
    poetry run python -m scripts.seed_admins
"""

from __future__ import annotations

import secrets
import sys
import uuid
from dataclasses import dataclass, field

from app.core.config.settings import settings
from app.core.supabase.client import get_supabase_client

ANAIDA = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
CETER = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
ALL_TENANTS = (ANAIDA, CETER)


@dataclass
class Membership:
    tenant_id: str
    role: str = "ADMIN"
    admin_scope: list[str] = field(default_factory=list)
    is_dev_admin: bool = False
    view: str = "admin"


@dataclass
class AdditionalEmail:
    email: str
    label: str | None = None
    purpose: str = "all"


@dataclass
class AdminSpec:
    primary_email: str
    real_email: bool
    first_name: str
    paternal_surname: str
    memberships: list[Membership]
    middle_name: str | None = None
    maternal_surname: str | None = None
    rut: str | None = None
    additional_emails: list[AdditionalEmail] = field(default_factory=list)


# RUTs verified mod-11 valid (compute_dv body=20442436 → 5; 18123456 → 3; 19234567 → 7)
ADMINS: list[AdminSpec] = [
    AdminSpec(
        primary_email="vicenteaguero@uc.cl",
        real_email=True,
        first_name="Vicente",
        middle_name="Joaquín",
        paternal_surname="Agüero",
        maternal_surname="López",
        rut="20442436-5",
        memberships=[
            Membership(ANAIDA, role="ADMIN", admin_scope=[], is_dev_admin=True, view="admin-dev"),
            Membership(CETER, role="ADMIN", admin_scope=[], is_dev_admin=True, view="admin-dev"),
        ],
        additional_emails=[
            AdditionalEmail("vicenteaguerocl@gmail.com", "personal"),
            AdditionalEmail("vicente@propos.dev", "work"),
            AdditionalEmail("vicente@anaida.cl", "anaida"),
            AdditionalEmail("vicente@ceterpropiedades.cl", "ceter"),
        ],
    ),
    AdminSpec(
        primary_email="vicente+plain@propos.dev",
        real_email=False,
        first_name="Vicente",
        middle_name="Joaquín",
        paternal_surname="Agüero",
        maternal_surname="López",
        rut=None,
        memberships=[
            Membership(ANAIDA, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
            Membership(CETER, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
        ],
    ),
    AdminSpec(
        primary_email="ana@propos.dev",
        real_email=False,
        first_name="Ana",
        paternal_surname="Carreño",
        rut="18123456-3",
        memberships=[
            Membership(ANAIDA, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
            Membership(CETER, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
        ],
    ),
    AdminSpec(
        primary_email="jaime@propos.dev",
        real_email=False,
        first_name="Jaime",
        middle_name="Luis",
        paternal_surname="Agüero",
        maternal_surname="Gaete",
        rut="19234567-7",
        memberships=[
            Membership(ANAIDA, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
            Membership(CETER, role="ADMIN", admin_scope=[], is_dev_admin=False, view="admin"),
        ],
    ),
]

TEST_OWNER = AdminSpec(
    primary_email="owner+test@propos.dev",
    real_email=False,
    first_name="Carlos",
    paternal_surname="Pérez",
    rut=None,
    memberships=[
        Membership(ANAIDA, role="LANDOWNER", admin_scope=[], is_dev_admin=False, view="owner"),
    ],
)

SAMPLE_PROPERTY_ID = str(uuid.UUID("deadbeef-dead-beef-dead-beefdeadbeef"))
SAMPLE_DOC_ID = str(uuid.UUID("cafebabe-cafe-babe-cafe-babecafebabe"))
SAMPLE_GRANT_CAPS = ["view_property", "view_documents", "view_visits"]


def _existing_user_id(client, email: str) -> str | None:
    resp = client.table("profiles").select("id").ilike("email", email).limit(1).execute()
    return resp.data[0]["id"] if resp.data else None


def seed_user(client, spec: AdminSpec) -> str | None:
    email = spec.primary_email.lower()
    existing = _existing_user_id(client, email)
    if existing:
        print(f"skip {email}: already exists ({existing})")
        return existing

    snapshot = spec.memberships[0]
    if spec.real_email:
        try:
            auth_resp = client.auth.admin.invite_user_by_email(
                email,
                {"redirect_to": f"{settings.app_base_url}/auth/setup"},
            )
            password_hint = "(magic invite sent)"
        except Exception as exc:
            print(f"  ERROR invite {email}: {exc}", file=sys.stderr)
            return None
    else:
        password = secrets.token_urlsafe(16)
        try:
            auth_resp = client.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": " ".join(
                            filter(
                                None,
                                [
                                    spec.first_name,
                                    spec.middle_name,
                                    spec.paternal_surname,
                                    spec.maternal_surname,
                                ],
                            )
                        ),
                    },
                }
            )
            password_hint = f"(password: {password})"
        except Exception as exc:
            print(f"  ERROR create {email}: {exc}", file=sys.stderr)
            return None

    user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
    if not user_id:
        print(f"  ERROR no user_id for {email}", file=sys.stderr)
        return None

    profile = {
        "id": user_id,
        "tenant_id": snapshot.tenant_id,
        "first_name": spec.first_name,
        "middle_name": spec.middle_name,
        "paternal_surname": spec.paternal_surname,
        "maternal_surname": spec.maternal_surname,
        "role": snapshot.role,
        "admin_scope": snapshot.admin_scope,
        "is_dev_admin": snapshot.is_dev_admin,
        "view": snapshot.view,
        "is_active": True,
        "email": email,
        "rut": spec.rut,
    }
    try:
        client.table("profiles").insert(profile).execute()
    except Exception as exc:
        print(f"  ERROR profile insert {email}: {exc}", file=sys.stderr)
        try:
            client.auth.admin.delete_user(user_id)
        except Exception:  # noqa: BLE001
            pass
        return None

    membership_rows = [
        {
            "user_id": user_id,
            "tenant_id": m.tenant_id,
            "role": m.role,
            "admin_scope": m.admin_scope,
            "is_dev_admin": m.is_dev_admin,
            "view": m.view,
        }
        for m in spec.memberships
    ]
    try:
        client.table("tenant_memberships").insert(membership_rows).execute()
    except Exception as exc:
        print(f"  WARN memberships insert {email}: {exc}", file=sys.stderr)

    email_rows = [
        {
            "tenant_id": snapshot.tenant_id,
            "user_id": user_id,
            "email": email,
            "label": "primary",
            "purpose": "all",
            "is_primary": True,
        }
    ]
    for extra in spec.additional_emails:
        email_rows.append(
            {
                "tenant_id": snapshot.tenant_id,
                "user_id": user_id,
                "email": extra.email.lower(),
                "label": extra.label,
                "purpose": extra.purpose,
                "is_primary": False,
            }
        )
    try:
        client.table("user_emails").insert(email_rows).execute()
    except Exception as exc:
        print(f"  WARN user_emails insert {email}: {exc}", file=sys.stderr)

    print(f"  OK  {email} {password_hint}")
    return user_id


def seed_sample_data(client, owner_user_id: str | None, granted_by_user_id: str | None) -> None:
    if not owner_user_id or not granted_by_user_id:
        print("skipping sample property/grant/doc (missing owner or admin)", file=sys.stderr)
        return

    # Sample property in Anaida.
    existing_prop = client.table("properties").select("id").eq("id", SAMPLE_PROPERTY_ID).limit(1).execute()
    if not existing_prop.data:
        try:
            client.table("properties").insert(
                {
                    "id": SAMPLE_PROPERTY_ID,
                    "tenant_id": ANAIDA,
                    "title": "Casa de Prueba — Las Condes",
                    "address": "Av. Apoquindo 1234, Las Condes",
                    "status": "AVAILABLE",
                    "is_draft": False,
                    "created_by": granted_by_user_id,
                }
            ).execute()
            print(f"  OK property {SAMPLE_PROPERTY_ID}")
        except Exception as exc:
            print(f"  ERROR property insert: {exc}", file=sys.stderr)
            return

    # Property grant for owner (view-only, no download).
    try:
        client.table("property_grants").upsert(
            {
                "user_id": owner_user_id,
                "property_id": SAMPLE_PROPERTY_ID,
                "tenant_id": ANAIDA,
                "view": "owner",
                "capabilities": SAMPLE_GRANT_CAPS,
                "granted_by": granted_by_user_id,
            },
            on_conflict="user_id,property_id",
        ).execute()
        print(f"  OK grant owner→property caps={SAMPLE_GRANT_CAPS}")
    except Exception as exc:
        print(f"  ERROR grant insert: {exc}", file=sys.stderr)

    # Sample document with audience_caps unlocked for owner (view only, no download).
    existing_doc = client.table("documents").select("id").eq("id", SAMPLE_DOC_ID).limit(1).execute()
    if not existing_doc.data:
        try:
            client.table("documents").insert(
                {
                    "id": SAMPLE_DOC_ID,
                    "tenant_id": ANAIDA,
                    "display_name": "Reglamento de copropiedad — borrador",
                    "kind": "PDF",
                    "origin": "UPLOAD",
                    "property_id": SAMPLE_PROPERTY_ID,
                    "audience_caps": {"owner": ["view"]},
                    "created_by": granted_by_user_id,
                }
            ).execute()
            print(f"  OK document {SAMPLE_DOC_ID} audience_caps=owner:[view]")
        except Exception as exc:
            print(f"  ERROR document insert: {exc}", file=sys.stderr)


def main() -> None:
    client = get_supabase_client()
    print("=== Seeding admins ===")
    admin_ids: list[str] = []
    for spec in ADMINS:
        uid = seed_user(client, spec)
        if uid:
            admin_ids.append(uid)

    print("\n=== Seeding test owner ===")
    owner_id = seed_user(client, TEST_OWNER)

    print("\n=== Seeding sample property + grant + document ===")
    granted_by = admin_ids[0] if admin_ids else None
    seed_sample_data(client, owner_id, granted_by)

    print("\nDone.")


if __name__ == "__main__":
    main()
