from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

WORKFLOWS_TABLE = "workflows"
STEPS_TABLE = "workflow_steps"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    if "state" in out and hasattr(out["state"], "value"):
        out["state"] = out["state"].value
    if "status" in out and hasattr(out["status"], "value"):
        out["status"] = out["status"].value
    return out


class WorkflowService:
    @staticmethod
    async def list_workflows(
        tenant_id: UUID,
        scope_table: str | None = None,
        scope_row_id: UUID | None = None,
    ) -> list[dict]:
        client = get_supabase_client()
        builder = (
            client.table(WORKFLOWS_TABLE)
            .select("*")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
        )
        if scope_table:
            builder = builder.eq("scope_table", scope_table)
        if scope_row_id:
            builder = builder.eq("scope_row_id", str(scope_row_id))
        return builder.execute().data

    @staticmethod
    async def create_workflow(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        steps = payload.steps
        data = payload.model_dump(exclude={"steps"})
        data = _norm(data)
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        wf = client.table(WORKFLOWS_TABLE).insert(data).execute().data[0]
        if steps:
            client.table(STEPS_TABLE).insert(
                [
                    {
                        "tenant_id": str(tenant_id),
                        "workflow_id": wf["id"],
                        "name": s,
                        "position": i,
                    }
                    for i, s in enumerate(steps)
                ]
            ).execute()
        return wf

    @staticmethod
    async def list_steps(workflow_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(STEPS_TABLE)
            .select("*")
            .eq("workflow_id", str(workflow_id))
            .eq("tenant_id", str(tenant_id))
            .order("position")
            .execute()
            .data
        )

    @staticmethod
    async def update_step(workflow_id: UUID, step_id: UUID, payload, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        if data.get("status") == "COMPLETED" and "completed_at" not in data:
            data["completed_at"] = datetime.now(UTC).isoformat()
        rows = (
            client.table(STEPS_TABLE)
            .update(data)
            .eq("id", str(step_id))
            .eq("workflow_id", str(workflow_id))
            .eq("tenant_id", str(tenant_id))
            .execute()
            .data
        )
        if not rows:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="step not found in workflow")
        return rows[0]
