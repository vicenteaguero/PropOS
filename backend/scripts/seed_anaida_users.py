"""Create the three ANAIDA broker accounts for the first day with real users.

Why this exists next to `seed_admins.py`: that script seeds the *demo* cast
across two tenants and still writes `is_dev_admin`/`view` into `profiles`, which
migration 032 moved onto `tenant_memberships`. This one creates the accounts the
brokerage actually signs in with, in one tenant, with the current column layout.

Every account is created with a temporary password and
`must_change_password = True`. The mailboxes on `anaida.cl` do not exist yet --
the domain is verified in Resend for *sending*, not for receiving -- so an invite
link would land nowhere. The password is handed over in person and the app
refuses to go anywhere until it is rotated (see
`shared/components/protected-route/protected-route.tsx`).

Idempotent: an account that already exists is left alone except for its
memberships, which are re-asserted.

Usage:
    poetry run python -m scripts.seed_anaida_users
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field

from app.core.supabase.client import get_supabase_client

ANAIDA = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

#: Handed over verbally, rotated on first sign-in. Eight characters is the
#: project minimum (`supabase/config.toml`, `minimum_password_length`), so this
#: is the shortest thing Auth will accept -- acceptable only because it cannot
#: survive the first session.
TEMP_PASSWORD = "12345678"


@dataclass
class UserSpec:
    email: str
    first_name: str
    paternal_surname: str
    middle_name: str | None = None
    maternal_surname: str | None = None
    rut: str | None = None
    role: str = "ADMIN"
    view: str = "admin"
    is_dev_admin: bool = False
    #: Empty list means "full admin" -- the whitelist is the *narrowing* axis.
    #: Day one shows everything; what gets hidden is decided per feature, per
    #: tenant, in `feature_states`, not by cutting each person's scope.
    admin_scope: list[str] = field(default_factory=list)


USERS: list[UserSpec] = [
    UserSpec(
        email="vicente@anaida.cl",
        first_name="Vicente",
        middle_name="Joaquín",
        paternal_surname="Agüero",
        maternal_surname="López",
    ),
    UserSpec(
        email="jaime@anaida.cl",
        first_name="Jaime",
        middle_name="Luis",
        paternal_surname="Agüero",
        maternal_surname="Gaete",
    ),
    UserSpec(
        email="ana@anaida.cl",
        first_name="Ana",
        paternal_surname="Carreño",
    ),
]


def _full_name(spec: UserSpec) -> str:
    parts = [spec.first_name, spec.middle_name, spec.paternal_surname, spec.maternal_surname]
    return " ".join(p for p in parts if p)


def _existing_user_id(client, email: str) -> str | None:
    resp = client.table("profiles").select("id").ilike("email", email).limit(1).execute()
    return resp.data[0]["id"] if resp.data else None


def _assert_membership(client, user_id: str, spec: UserSpec) -> None:
    """Re-assert the ANAIDA membership and make sure no other tenant leaks in.

    The point of these accounts is that they see one brokerage. A stray
    membership row is the only thing standing between that and the workspace
    switcher offering PropOS Demo to the owner's father.
    """
    row = {
        "user_id": user_id,
        "tenant_id": ANAIDA,
        "role": spec.role,
        "admin_scope": spec.admin_scope,
        "is_dev_admin": spec.is_dev_admin,
        "view": spec.view,
        "is_active": True,
    }
    client.table("tenant_memberships").upsert(row, on_conflict="user_id,tenant_id").execute()

    others = (
        client.table("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user_id)
        .neq("tenant_id", ANAIDA)
        .execute()
    )
    for extra in others.data or []:
        print(f"  removing membership in {extra['tenant_id']}")
        client.table("tenant_memberships").delete().eq("user_id", user_id).eq(
            "tenant_id", extra["tenant_id"]
        ).execute()


def seed_user(client, spec: UserSpec) -> str | None:
    email = spec.email.lower()
    existing = _existing_user_id(client, email)
    if existing:
        print(f"exists {email} ({existing}) — re-asserting membership only")
        _assert_membership(client, existing, spec)
        return existing

    try:
        auth_resp = client.auth.admin.create_user(
            {
                "email": email,
                "password": TEMP_PASSWORD,
                "email_confirm": True,
                "user_metadata": {"full_name": _full_name(spec)},
            }
        )
    except Exception as exc:
        print(f"  ERROR create {email}: {exc}", file=sys.stderr)
        return None

    user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
    if not user_id:
        print(f"  ERROR no user_id for {email}", file=sys.stderr)
        return None

    profile = {
        "id": user_id,
        "tenant_id": ANAIDA,
        "first_name": spec.first_name,
        "middle_name": spec.middle_name,
        "paternal_surname": spec.paternal_surname,
        "maternal_surname": spec.maternal_surname,
        "role": spec.role,
        "admin_scope": spec.admin_scope,
        "is_active": True,
        "email": email,
        "rut": spec.rut,
        "must_change_password": True,
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

    _assert_membership(client, user_id, spec)

    try:
        client.table("user_emails").insert(
            {
                "tenant_id": ANAIDA,
                "user_id": user_id,
                "email": email,
                "label": "primary",
                "purpose": "all",
                "is_primary": True,
            }
        ).execute()
    except Exception as exc:
        print(f"  WARN user_emails insert {email}: {exc}", file=sys.stderr)

    print(f"created {email} ({user_id}) — password {TEMP_PASSWORD}, must change on first login")
    return user_id


def repoint_dev_admin(client) -> None:
    """Park the dev account's active tenant on ANAIDA.

    It was pointing at `PropOS Demo` because that seed ran last, so signing in
    landed on the demo brokerage's data.
    """
    resp = (
        client.table("profiles")
        .update({"tenant_id": ANAIDA})
        .ilike("email", "vicenteaguero@uc.cl")
        .execute()
    )
    if resp.data:
        print("dev admin vicenteaguero@uc.cl active tenant -> ANAIDA")


def main() -> int:
    client = get_supabase_client()
    created = [seed_user(client, spec) for spec in USERS]
    repoint_dev_admin(client)
    return 0 if all(created) else 1


if __name__ == "__main__":
    raise SystemExit(main())
