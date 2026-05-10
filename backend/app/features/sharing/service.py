from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.core.logging.logger import get_logger
from app.core.supabase.client import get_supabase_client

logger = get_logger("SHARING")

ALLOWED_AUDIENCES = {"admin", "admin-dev", "agent", "owner", "buyer", "content"}
ALLOWED_DOC_CAPS = {"view", "download"}
ALLOWED_VISIT_CAPS = {"view", "view_visitor_identity", "view_visit_documents"}


def _validate_caps(caps: dict, allowed: set[str]) -> None:
    if not isinstance(caps, dict):
        raise HTTPException(status_code=422, detail="audience_caps must be an object")
    for audience, cap_list in caps.items():
        if audience not in ALLOWED_AUDIENCES:
            raise HTTPException(status_code=422, detail=f"Unknown audience: {audience}")
        if not isinstance(cap_list, list):
            raise HTTPException(status_code=422, detail=f"caps for {audience} must be a list")
        for cap in cap_list:
            if cap not in allowed:
                raise HTTPException(status_code=422, detail=f"Unknown cap '{cap}' for {audience}")


class SharingService:
    @staticmethod
    async def set_document_sharing(document_id: UUID, audience_caps: dict, property_id: UUID | None = None) -> dict:
        _validate_caps(audience_caps, ALLOWED_DOC_CAPS)
        client = get_supabase_client()
        patch: dict = {"audience_caps": audience_caps}
        if property_id is not None:
            patch["property_id"] = str(property_id)
        resp = client.table("documents").update(patch).eq("id", str(document_id)).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Document not found")
        return resp.data[0]

    @staticmethod
    async def set_interaction_sharing(interaction_id: UUID, audience_caps: dict) -> dict:
        _validate_caps(audience_caps, ALLOWED_VISIT_CAPS)
        client = get_supabase_client()
        resp = (
            client.table("interactions")
            .update({"audience_caps": audience_caps})
            .eq("id", str(interaction_id))
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Interaction not found")
        return resp.data[0]
