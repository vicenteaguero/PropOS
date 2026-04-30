from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

CONTACTS_TABLE = "contacts"
ALIASES_TABLE = "person_aliases"

logger = get_logger("CONTACTS")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    """Convert datetime/date/UUID to ISO/str so supabase-py JSON works."""
    from datetime import date, datetime

    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


class ContactService:
    @staticmethod
    async def list_contacts(
        tenant_id: UUID,
        query: str | None = None,
        include_drafts: bool = True,
        include_deleted: bool = False,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .order("created_at", desc=True)
        )
        if not include_drafts:
            builder = builder.eq("is_draft", False)
        if not include_deleted:
            builder = builder.is_("deleted_at", "null")
        if query:
            builder = builder.ilike("full_name", f"%{query}%")
        return builder.execute().data

    @staticmethod
    async def get_contact(contact_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def create_contact(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump()
        aliases: list[str] = data.pop("aliases", [])
        data["type"] = data["type"].value if hasattr(data["type"], "value") else data["type"]
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        if data.get("email") is not None:
            data["email"] = str(data["email"])
        data = _serialize(data)
        response = client.table(CONTACTS_TABLE).insert(data).execute()
        contact = response.data[0]

        if aliases:
            ContactService._set_aliases(
                UUID(contact["id"]), tenant_id, aliases
            )
        logger.info("created", event_type="write", contact_id=contact["id"])
        return contact

    @staticmethod
    async def update_contact(
        contact_id: UUID, payload, tenant_id: UUID
    ) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if "type" in data and data["type"] is not None:
            data["type"] = data["type"].value if hasattr(data["type"], "value") else data["type"]
        if "email" in data and data["email"] is not None:
            data["email"] = str(data["email"])
        data = _serialize(data)
        response = (
            client.table(CONTACTS_TABLE)
            .update(data)
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )
        return response.data[0]

    @staticmethod
    async def delete_contact(contact_id: UUID, tenant_id: UUID) -> None:
        # Soft delete
        from datetime import UTC, datetime

        client = get_supabase_client()
        (
            client.table(CONTACTS_TABLE)
            .update({"deleted_at": datetime.now(UTC).isoformat()})
            .eq("id", str(contact_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
        )

    # --- Aliases (used by Anita find_person fuzzy matching) ---

    @staticmethod
    def _set_aliases(person_id: UUID, tenant_id: UUID, aliases: list[str]) -> None:
        client = get_supabase_client()
        rows = [
            {
                "tenant_id": str(tenant_id),
                "person_id": str(person_id),
                "alias": a.strip(),
            }
            for a in aliases
            if a.strip()
        ]
        if not rows:
            return
        client.table(ALIASES_TABLE).upsert(
            rows, on_conflict="tenant_id,person_id,alias"
        ).execute()

    @staticmethod
    async def list_aliases(person_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(ALIASES_TABLE)
            .select("*")
            .eq("person_id", str(person_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
        )

    @staticmethod
    async def add_alias(person_id: UUID, tenant_id: UUID, alias: str) -> dict:
        client = get_supabase_client()
        return (
            client.table(ALIASES_TABLE)
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "person_id": str(person_id),
                    "alias": alias.strip(),
                }
            )
            .execute()
            .data[0]
        )

    @staticmethod
    async def search_fuzzy(tenant_id: UUID, query: str, limit: int = 10) -> list[dict]:
        """Fuzzy person search using pg_trgm against full_name + aliases.

        Used by Anita's find_person tool. Returns candidates with score.
        """
        client = get_supabase_client()
        # Simple ilike for now; trgm-scored search via RPC added in Phase D.
        return (
            client.table(CONTACTS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .ilike("full_name", f"%{query}%")
            .is_("deleted_at", "null")
            .limit(limit)
            .execute()
            .data
        )
