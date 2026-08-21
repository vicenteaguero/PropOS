"""Which stage moves are legal, and which ones a person has to make.

`opportunities.pipeline_stage` is bare TEXT with no check and no FK, so until
now every move was legal — including LEAD straight to CLOSED, and including
anything Propo felt like doing. That was tolerable while only humans moved
deals. It stopped being tolerable the moment the assistant could.

Enforced here rather than in a database trigger for two reasons: this is where
the audit attribution context already is, and a refusal can be a sentence in
Spanish instead of a constraint violation surfacing as a 500.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException

from app.core.supabase.client import get_supabase_client

#: Raised as 409, because the client's request is coherent and the CONFLICT is
#: with the state of the deal — a 422 would say the payload was malformed.
_CONFLICT = 409


class TransitionDenied(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=_CONFLICT, detail=detail)


def _transitions(tenant_id: UUID, pipeline_id: str) -> list[dict]:
    return (
        get_supabase_client()
        .table("pipeline_transitions")
        .select("from_stage,to_stage,requires_human")
        .eq("tenant_id", str(tenant_id))
        .eq("pipeline_id", pipeline_id)
        .execute()
        .data
        or []
    )


def assert_allowed(
    tenant_id: UUID,
    opportunity: dict,
    to_stage: str,
    *,
    by_agent: bool,
) -> None:
    """Refuse an illegal move, and refuse a legal one the AI may not make.

    A deal with no pipeline is unconstrained on purpose: pipelines are optional
    and a tenant that has not configured one should not find its CRM frozen.
    """
    from_stage = opportunity.get("pipeline_stage")
    if from_stage == to_stage:
        return

    pipeline_id = opportunity.get("pipeline_id")
    if not pipeline_id:
        return

    rows = _transitions(tenant_id, pipeline_id)
    if not rows:
        # Configured pipeline, no transitions declared: the tenant has not
        # opted into the machine. Do not invent rules for them.
        return

    match = next(
        (r for r in rows if r["to_stage"] == to_stage and r["from_stage"] in (from_stage, None)),
        None,
    )
    if match is None:
        raise TransitionDenied(f"No se puede mover de «{from_stage}» a «{to_stage}» en este pipeline.")
    if by_agent and match["requires_human"]:
        raise TransitionDenied(f"Mover a «{to_stage}» lo tiene que hacer una persona, no {'Propo'}.")


def allowed_targets(tenant_id: UUID, opportunity: dict) -> list[dict]:
    """The moves available from here, so the UI offers only legal ones.

    One target, one entry. A `from_stage = NULL` row means "from any stage" (see
    the Pipelines catalogue), so a pipeline that declares both the wildcard and
    an explicit `OFFER -> LOST` matches twice — and the deal page rendered a
    second identical "Perdido" button beside the first, on a duplicate React
    key. That is legal configuration, not bad data, so it has to collapse here.

    `requires_human` merges by OR: if any declared path to a stage insists on a
    person, the move does. Taking the looser of two paths would let Propo make a
    move the tenant deliberately reserved for a human.
    """
    pipeline_id = opportunity.get("pipeline_id")
    if not pipeline_id:
        return []
    from_stage = opportunity.get("pipeline_stage")
    merged: dict[str, bool] = {}
    for r in _transitions(tenant_id, pipeline_id):
        if r["from_stage"] not in (from_stage, None) or r["to_stage"] == from_stage:
            continue
        to_stage = r["to_stage"]
        merged[to_stage] = merged.get(to_stage, False) or bool(r["requires_human"])
    return [{"to_stage": k, "requires_human": v} for k, v in merged.items()]
