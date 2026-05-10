"""Delete all auth.users via Supabase Admin API.

Used by `make db-nuke` BEFORE `supabase db reset --linked` so FK cascades
have proper context. After this script + the db reset, both auth and
tables are empty, ready for `make seed-admins`.

Usage:
    poetry run python -m scripts.nuke_auth_users
"""

from __future__ import annotations

import sys

from app.core.supabase.client import get_supabase_client


def main() -> None:
    client = get_supabase_client()
    page = 1
    total = 0
    while True:
        try:
            resp = client.auth.admin.list_users(page=page, per_page=100)
        except Exception as exc:
            print(f"list_users failed: {exc}", file=sys.stderr)
            sys.exit(1)
        users = resp if isinstance(resp, list) else getattr(resp, "users", []) or []
        if not users:
            break
        for u in users:
            uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
            email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
            if not uid:
                continue
            try:
                client.auth.admin.delete_user(uid)
                print(f"  deleted {email} ({uid})")
                total += 1
            except Exception as exc:
                print(f"  ERROR deleting {email}: {exc}", file=sys.stderr)
        if len(users) < 100:
            break
        page += 1
    print(f"\nTotal auth users deleted: {total}")


if __name__ == "__main__":
    main()
