"""Read and set what Propo may do on its own.

Separate router from `agent/router.py` on purpose: that one is the chat surface
and is gated on the `agent` scope, but deciding the AI's autonomy is an
administration act. A brokerage may well want somebody who never opens the
assistant to be the person who decides what it is allowed to do.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.core.supabase.client import get_supabase_client
from app.features.agent.intent_registry import REGISTRY
from app.features.agent.policies import AutonomyLevel, default_level

router = APIRouter(
    prefix="/agent/policies",
    tags=["agent-policies"],
    dependencies=[Depends(require_role("ADMIN"))],
)


class ActionPolicy(BaseModel):
    action_kind: str
    level: AutonomyLevel
    #: True when no row exists and the risk-tiered code default is in force.
    is_default: bool
    #: What the code would choose, so the UI can offer "restore".
    default_level: AutonomyLevel


class SetPolicyRequest(BaseModel):
    level: AutonomyLevel


@router.get("", response_model=list[ActionPolicy])
async def list_policies(tenant_id: UUID = Depends(get_tenant_id)) -> list[ActionPolicy]:
    """Every action Propo knows how to take, with its effective level.

    Driven by the intent registry rather than by the table, so an action added
    in code shows up here immediately at its default instead of being invisible
    until somebody configures it.
    """
    rows = (
        get_supabase_client()
        .table("agent_action_policies")
        .select("action_kind, level")
        .eq("tenant_id", str(tenant_id))
        .execute()
        .data
        or []
    )
    configured = {row["action_kind"]: row["level"] for row in rows}
    return [
        ActionPolicy(
            action_kind=name,
            level=AutonomyLevel(configured.get(name, default_level(name))),
            is_default=name not in configured,
            default_level=default_level(name),
        )
        for name in sorted(REGISTRY)
    ]


@router.put("/{action_kind}", response_model=ActionPolicy)
async def set_policy(
    action_kind: str,
    payload: SetPolicyRequest,
    tenant_id: UUID = Depends(get_tenant_id),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ActionPolicy:
    """Override one action for this tenant."""
    get_supabase_client().table("agent_action_policies").upsert(
        {
            "tenant_id": str(tenant_id),
            "action_kind": action_kind,
            "level": payload.level.value,
            "updated_by": str(current_user["id"]),
            "updated_at": "now()",
        },
        on_conflict="tenant_id,action_kind",
    ).execute()
    return ActionPolicy(
        action_kind=action_kind,
        level=payload.level,
        is_default=False,
        default_level=default_level(action_kind),
    )


@router.delete("/{action_kind}", response_model=ActionPolicy)
async def reset_policy(
    action_kind: str,
    tenant_id: UUID = Depends(get_tenant_id),
) -> ActionPolicy:
    """Drop the override and fall back to the risk-tiered default."""
    (
        get_supabase_client()
        .table("agent_action_policies")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("action_kind", action_kind)
        .execute()
    )
    return ActionPolicy(
        action_kind=action_kind,
        level=default_level(action_kind),
        is_default=True,
        default_level=default_level(action_kind),
    )
