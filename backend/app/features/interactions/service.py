from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

INTERACTIONS_TABLE = "interactions"
PARTICIPANTS_TABLE = "interaction_participants"
TARGETS_TABLE = "interaction_targets"

logger = get_logger("INTERACTIONS")


def _serialize(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    return out


def _with_relations(rows: list[dict]) -> list[dict]:
    """Rename the embedded relations to the names the response model uses.

    PostgREST returns `interaction_participants` / `interaction_targets`;
    `InteractionResponse` declares `participants` / `targets` with a default of
    `[]`. FastAPI therefore dropped both and served empty lists — the list
    endpoint has never once returned who was in an interaction or what it was
    about, silently, because the default made it look like there simply were
    none.
    """
    for row in rows:
        row["participants"] = row.pop("interaction_participants", None) or []
        row["targets"] = row.pop("interaction_targets", None) or []
    return rows


class InteractionService:
    @staticmethod
    async def list_interactions(
        tenant_id: UUID,
        kind: str | None = None,
        person_id: UUID | None = None,
        property_id: UUID | None = None,
        limit: int = 100,
    ) -> list[dict]:
        client = get_supabase_client()

        # Filter in the DATABASE, not after the fetch. This used to pull the
        # newest `limit` interactions for the whole tenant and then keep the
        # ones matching the person — so a contact whose last interaction was
        # older than the tenant's 100 most recent got an empty timeline, which
        # reads as "never contacted" rather than "not in this page".
        #
        # Two queries rather than one, on purpose. A single `!inner` embed
        # filters the EMBEDDED rows too, so the participants list would come
        # back holding only the person searched for — and the timeline shows who
        # else was in the room. So: page the ids with the inner filter (at most
        # `limit` of them, which keeps the follow-up URL bounded), then fetch
        # those ids with the embeds unfiltered.
        ids: list[str] | None = None
        if person_id is not None or property_id is not None:
            embeds = []
            if person_id is not None:
                embeds.append("interaction_participants!inner(person_id)")
            if property_id is not None:
                embeds.append("interaction_targets!inner(property_id)")
            page = (
                client.table(INTERACTIONS_TABLE)
                .select(", ".join(["id", *embeds]))
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .order("occurred_at", desc=True)
                .limit(limit)
            )
            if kind:
                page = page.eq("kind", kind)
            if person_id is not None:
                page = page.eq("interaction_participants.person_id", str(person_id))
            if property_id is not None:
                page = page.eq("interaction_targets.property_id", str(property_id))
            ids = [row["id"] for row in (page.execute().data or [])]
            if not ids:
                return []

        builder = (
            client.table(INTERACTIONS_TABLE)
            .select("*, interaction_participants(*), interaction_targets(*)")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("occurred_at", desc=True)
            .limit(limit)
        )
        if kind:
            builder = builder.eq("kind", kind)
        if ids is not None:
            builder = builder.in_("id", ids)
        return _with_relations(builder.execute().data or [])

    @staticmethod
    async def get_interaction(interaction_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        row = (
            client.table(INTERACTIONS_TABLE)
            .select("*, interaction_participants(*), interaction_targets(*)")
            .eq("id", str(interaction_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        return _with_relations([row])[0] if row else row

    @staticmethod
    async def create_interaction(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude={"participants", "targets"})
        if data.get("kind") and hasattr(data["kind"], "value"):
            data["kind"] = data["kind"].value
        if data.get("sentiment") and hasattr(data["sentiment"], "value"):
            data["sentiment"] = data["sentiment"].value
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        if not data.get("occurred_at"):
            data["occurred_at"] = datetime.now(UTC).isoformat()
        data = _serialize(data)
        response = client.table(INTERACTIONS_TABLE).insert(data).execute()
        interaction = response.data[0]

        # Participants
        if payload.participants:
            client.table(PARTICIPANTS_TABLE).insert(
                [
                    {
                        "tenant_id": str(tenant_id),
                        "interaction_id": interaction["id"],
                        "person_id": str(p.person_id),
                        "role": p.role,
                    }
                    for p in payload.participants
                ]
            ).execute()

        # Targets
        if payload.targets:
            client.table(TARGETS_TABLE).insert(
                [
                    {
                        "tenant_id": str(tenant_id),
                        "interaction_id": interaction["id"],
                        "target_kind": t.target_kind.value,
                        "property_id": str(t.property_id) if t.property_id else None,
                        "project_id": str(t.project_id) if t.project_id else None,
                        "opportunity_id": str(t.opportunity_id) if t.opportunity_id else None,
                        "place_id": str(t.place_id) if t.place_id else None,
                    }
                    for t in payload.targets
                ]
            ).execute()

        logger.info("created", event_type="write", interaction_id=interaction["id"])
        return await InteractionService.get_interaction(UUID(interaction["id"]), tenant_id)

    @staticmethod
    async def update_interaction(interaction_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = payload.model_dump(exclude_unset=True)
        if data.get("kind") and hasattr(data["kind"], "value"):
            data["kind"] = data["kind"].value
        if data.get("sentiment") and hasattr(data["sentiment"], "value"):
            data["sentiment"] = data["sentiment"].value
        data = _serialize(data)
        client.table(INTERACTIONS_TABLE).update(data).eq("id", str(interaction_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
        return await InteractionService.get_interaction(interaction_id, tenant_id)

    @staticmethod
    async def delete_interaction(interaction_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(INTERACTIONS_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq(
            "id", str(interaction_id)
        ).eq("tenant_id", str(tenant_id)).execute()
