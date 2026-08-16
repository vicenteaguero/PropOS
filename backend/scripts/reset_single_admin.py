"""Keep ONLY one admin auth user, reset its password, delete every other auth user.

Destructive: deletes every other auth.user (cascades to their profiles/memberships).
Safety: requires --yes, and aborts if the keep-email is not found, so it can never
wipe everything by mistake. There is one shared Supabase project (no staging DB) —
running this points at whatever `.env` you have loaded, including production.

Config comes from the environment, never from this file:
    RESET_KEEP_EMAIL     email to keep (required)
    RESET_NEW_PASSWORD   new password for that account (required)

Usage (Poetry is broken on this machine — run via the project venv directly):
    cd <repo-root> && set -a && . ./.env && set +a && PYTHONPATH=backend \
      RESET_KEEP_EMAIL=you@example.com RESET_NEW_PASSWORD='<strong-password>' \
      ~/Library/Caches/pypoetry/virtualenvs/propos-backend-F68E3XRv-py3.12/bin/python \
      -m scripts.reset_single_admin --yes
"""

from __future__ import annotations

import os
import sys

from app.core.supabase.client import get_supabase_client

KEEP_EMAIL = os.environ.get("RESET_KEEP_EMAIL", "")
NEW_PASSWORD = os.environ.get("RESET_NEW_PASSWORD", "")


def _uid_email(u: object) -> tuple[str | None, str]:
    uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
    email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
    return uid, (email or "").lower()


def _list_all(client) -> list:
    users: list = []
    page = 1
    while True:
        resp = client.auth.admin.list_users(page=page, per_page=100)
        batch = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
        if not batch:
            break
        users.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return users


def main() -> None:
    if "--yes" not in sys.argv:
        print(
            "ABORT: this deletes every auth user except one. Re-run with --yes.",
            file=sys.stderr,
        )
        sys.exit(2)
    if not KEEP_EMAIL or not NEW_PASSWORD:
        print(
            "ABORT: set RESET_KEEP_EMAIL and RESET_NEW_PASSWORD in the environment.",
            file=sys.stderr,
        )
        sys.exit(2)

    client = get_supabase_client()
    users = _list_all(client)
    print(f"found {len(users)} auth users")

    keep = next((u for u in users if _uid_email(u)[1] == KEEP_EMAIL.lower()), None)
    if keep is None:
        print(
            f"ABORT: {KEEP_EMAIL} not found — refusing to delete everything.",
            file=sys.stderr,
        )
        sys.exit(1)

    keep_uid, _ = _uid_email(keep)

    # 1) set password + confirm email on the kept account
    client.auth.admin.update_user_by_id(keep_uid, {"password": NEW_PASSWORD, "email_confirm": True})
    print(f"set password on {KEEP_EMAIL} ({keep_uid})")

    # 2) ensure it is ADMIN + admin-dev
    try:
        client.table("profiles").update(
            {"role": "ADMIN", "view": "admin-dev", "is_dev_admin": True, "is_active": True}
        ).eq("id", keep_uid).execute()
        client.table("tenant_memberships").update(
            {"role": "ADMIN", "is_dev_admin": True, "view": "admin-dev", "is_active": True}
        ).eq("user_id", keep_uid).execute()
        print("ensured ADMIN + admin-dev on profile + memberships")
    except Exception as exc:  # noqa: BLE001
        print(f"WARN profile/membership update: {exc}", file=sys.stderr)

    # 3) delete every other auth user (cascades)
    deleted = 0
    for u in users:
        uid, email = _uid_email(u)
        if not uid or uid == keep_uid:
            continue
        try:
            client.auth.admin.delete_user(uid)
            print(f"  deleted {email} ({uid})")
            deleted += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR deleting {email}: {exc}", file=sys.stderr)

    print(f"\nDONE — kept {KEEP_EMAIL} (admin-dev, pw set), deleted {deleted}. remaining: 1")


if __name__ == "__main__":
    main()
