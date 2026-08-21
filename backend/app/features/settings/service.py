"""The two catalogs that used to be frozen Python constants.

`message_templates` and `checklist_templates` became tables so that adding a
WhatsApp template or changing a closing checklist stops being a deploy. Nothing
edited them, though, which left the tables exactly as inert as the constants
they replaced. This is the write side.

Every read and every write is scoped with `.eq("tenant_id", …)`. The service
role client bypasses RLS, so an id on its own reaches any brokerage's row —
the tenant filter is the only thing standing between two customers.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException

from app.core.supabase.client import get_supabase_client
from app.features.settings.schemas import (
    ApprovalStatus,
    ChecklistItemWrite,
    ChecklistTemplate,
    ChecklistTemplateWrite,
    MessageTemplate,
    MessageTemplateWrite,
    Pipeline,
    PipelineTransition,
    PipelineWrite,
    Tag,
    TagWrite,
)

#: Meta's positional placeholder, `{{1}}`. Whitespace inside the braces is what
#: the WhatsApp Manager itself emits when a template is pasted back out.
_PLACEHOLDER = re.compile(r"\{\{\s*(\d+)\s*\}\}")

#: Statuses where Meta has already been told what the body says. Editing the
#: body after that point makes the stored approval a lie.
_LOCKED_BY_META = (ApprovalStatus.SUBMITTED, ApprovalStatus.APPROVED)

_TEMPLATE_COLUMNS = (
    "id,name,channel,category,language,body,variables,external_name,approval_status,approved_at,updated_at"
)
_ITEM_COLUMNS = "id,position,title,description,blocking,owner_role,due_offset_days,document_kind"


def _client():
    return get_supabase_client()


# ---------------------------------------------------------------------------
# Placeholders
# ---------------------------------------------------------------------------


def placeholders_in(body: str) -> list[int]:
    """The distinct `{{n}}` indices in a body, ascending."""
    return sorted({int(match) for match in _PLACEHOLDER.findall(body)})


def validate_variables(body: str, variables: list[str]) -> None:
    """Check that the named variables and the positional slots line up.

    Meta does not know our names; it substitutes by position, so `variables[0]`
    IS `{{1}}`. A body with three slots and two names sends the wrong value in
    the third — the sort of bug that only shows up in a customer's chat, which
    is why it is refused here instead of at send time.
    """
    slots = placeholders_in(body)
    if slots and slots != list(range(1, len(slots) + 1)):
        raise HTTPException(
            status_code=422,
            detail=f"placeholders must run from 1 with no gaps, got {slots}",
        )
    if len(variables) != len(slots):
        raise HTTPException(
            status_code=422,
            detail=f"body uses {len(slots)} placeholder(s) but {len(variables)} variable name(s) were given",
        )
    cleaned = [name.strip() for name in variables]
    if any(not name for name in cleaned):
        raise HTTPException(status_code=422, detail="variable names cannot be blank")
    if len(set(cleaned)) != len(cleaned):
        raise HTTPException(status_code=422, detail="variable names must be unique")


def resolve_approval(
    payload: MessageTemplateWrite,
    stored: dict[str, Any] | None,
) -> tuple[ApprovalStatus, str | None]:
    """The status a save lands on, and the `approved_at` that goes with it.

    Meta approves a specific body, not a template id. Editing the text of an
    approved template and keeping the badge would leave the screen claiming a
    message is sendable when Meta will reject it, so any change to what was
    submitted drops the template back to `draft`.
    """
    if stored is None:
        return payload.approval_status, "now()" if payload.approval_status == ApprovalStatus.APPROVED else None

    current = ApprovalStatus(stored["approval_status"])
    submitted_changed = (
        payload.body != stored.get("body")
        or payload.name != stored.get("name")
        or payload.category.value != stored.get("category")
        or payload.language != stored.get("language")
        or payload.variables != (stored.get("variables") or [])
    )
    if current in _LOCKED_BY_META and submitted_changed and payload.approval_status == current:
        return ApprovalStatus.DRAFT, None

    if payload.approval_status == ApprovalStatus.APPROVED:
        # Keep the original timestamp when it was already approved; stamp a new
        # one when this save is what approved it.
        return payload.approval_status, stored.get("approved_at") if current == ApprovalStatus.APPROVED else "now()"
    return payload.approval_status, None


# ---------------------------------------------------------------------------
# Message templates
# ---------------------------------------------------------------------------


def _to_template(row: dict[str, Any]) -> MessageTemplate:
    return MessageTemplate(**{**row, "variables": row.get("variables") or []})


def list_message_templates(tenant_id: UUID) -> list[MessageTemplate]:
    rows = (
        _client()
        .table("message_templates")
        .select(_TEMPLATE_COLUMNS)
        .eq("tenant_id", str(tenant_id))
        .order("name")
        .execute()
        .data
        or []
    )
    return [_to_template(row) for row in rows]


def _get_template_row(tenant_id: UUID, template_id: UUID) -> dict[str, Any]:
    rows = (
        _client()
        .table("message_templates")
        .select(_TEMPLATE_COLUMNS)
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")
    return rows[0]


def _template_values(payload: MessageTemplateWrite, status: ApprovalStatus, approved_at: str | None) -> dict[str, Any]:
    return {
        "name": payload.name.strip(),
        "channel": payload.channel.value,
        "category": payload.category.value,
        "language": payload.language,
        "body": payload.body,
        "variables": [name.strip() for name in payload.variables],
        "external_name": (payload.external_name or "").strip() or None,
        "approval_status": status.value,
        "approved_at": approved_at,
    }


def create_message_template(tenant_id: UUID, user_id: UUID, payload: MessageTemplateWrite) -> MessageTemplate:
    validate_variables(payload.body, payload.variables)
    status, approved_at = resolve_approval(payload, None)
    values = {
        **_template_values(payload, status, approved_at),
        "tenant_id": str(tenant_id),
        "created_by": str(user_id),
    }
    rows = _client().table("message_templates").insert(values).execute().data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Template was not created")
    return _to_template(rows[0])


def update_message_template(tenant_id: UUID, template_id: UUID, payload: MessageTemplateWrite) -> MessageTemplate:
    stored = _get_template_row(tenant_id, template_id)
    validate_variables(payload.body, payload.variables)
    status, approved_at = resolve_approval(payload, stored)
    values = {**_template_values(payload, status, approved_at), "updated_at": "now()"}
    rows = (
        _client()
        .table("message_templates")
        .update(values)
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_template(rows[0])


def delete_message_template(tenant_id: UUID, template_id: UUID) -> None:
    rows = (
        _client()
        .table("message_templates")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Template not found")


# ---------------------------------------------------------------------------
# Checklist templates
# ---------------------------------------------------------------------------


def normalize_items(items: list[ChecklistItemWrite]) -> list[dict[str, Any]]:
    """Renumber a submitted list to 1..n in the order it arrived.

    Position is a UNIQUE column and the reason the expediente reads top to
    bottom. Letting the client send it invites gaps and collisions from a
    drag-and-drop reorder, so the array order is the only input that counts.
    """
    return [
        {
            "position": index,
            "title": item.title.strip(),
            "description": (item.description or "").strip() or None,
            "blocking": item.blocking,
            "owner_role": (item.owner_role or "").strip() or None,
            "due_offset_days": item.due_offset_days,
            "document_kind": (item.document_kind or "").strip() or None,
        }
        for index, item in enumerate(items, start=1)
    ]


def _load_items(tenant_id: UUID, template_id: str) -> list[dict[str, Any]]:
    return (
        _client()
        .table("checklist_template_items")
        .select(_ITEM_COLUMNS)
        .eq("tenant_id", str(tenant_id))
        .eq("template_id", template_id)
        .order("position")
        .execute()
        .data
        or []
    )


def list_checklist_templates(tenant_id: UUID) -> list[ChecklistTemplate]:
    """Both catalogs in one round trip per table, not one query per template."""
    templates = (
        _client()
        .table("checklist_templates")
        .select("id,name,operation_kind,is_default,updated_at")
        .eq("tenant_id", str(tenant_id))
        .order("operation_kind")
        .order("name")
        .execute()
        .data
        or []
    )
    if not templates:
        return []
    ids = [row["id"] for row in templates]
    items = (
        _client()
        .table("checklist_template_items")
        .select(f"template_id,{_ITEM_COLUMNS}")
        .eq("tenant_id", str(tenant_id))
        .in_("template_id", ids)
        .order("position")
        .execute()
        .data
        or []
    )
    by_template: dict[str, list[dict[str, Any]]] = {template_id: [] for template_id in ids}
    for item in items:
        by_template.setdefault(item["template_id"], []).append(item)
    return [
        ChecklistTemplate(**row, items=sorted(by_template.get(row["id"], []), key=lambda i: i["position"]))
        for row in templates
    ]


def get_checklist_template(tenant_id: UUID, template_id: UUID) -> ChecklistTemplate:
    rows = (
        _client()
        .table("checklist_templates")
        .select("id,name,operation_kind,is_default,updated_at")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Checklist template not found")
    return ChecklistTemplate(**rows[0], items=_load_items(tenant_id, str(template_id)))


def _clear_other_defaults(tenant_id: UUID, operation_kind: str, keep_id: str | None) -> None:
    """One default per operation kind.

    The database allows any number and the instantiator takes whichever sorts
    first, so two defaults means the checklist a deal gets is decided by row
    order. Making the flag exclusive is what makes it mean anything.
    """
    query = (
        _client()
        .table("checklist_templates")
        .update({"is_default": False})
        .eq("tenant_id", str(tenant_id))
        .eq("operation_kind", operation_kind)
        .eq("is_default", True)
    )
    if keep_id:
        query = query.neq("id", keep_id)
    query.execute()


def _replace_items(tenant_id: UUID, template_id: str, items: list[ChecklistItemWrite]) -> None:
    """Wholesale replace: UNIQUE (template_id, position) makes in-place
    renumbering a minefield of transient collisions."""
    (
        _client()
        .table("checklist_template_items")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("template_id", template_id)
        .execute()
    )
    rows = normalize_items(items)
    if not rows:
        return
    _client().table("checklist_template_items").insert(
        [{**row, "tenant_id": str(tenant_id), "template_id": template_id} for row in rows]
    ).execute()


def create_checklist_template(tenant_id: UUID, user_id: UUID, payload: ChecklistTemplateWrite) -> ChecklistTemplate:
    rows = (
        _client()
        .table("checklist_templates")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "name": payload.name.strip(),
                "operation_kind": payload.operation_kind.strip(),
                "is_default": payload.is_default,
                "created_by": str(user_id),
            }
        )
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Checklist template was not created")
    template_id = rows[0]["id"]
    if payload.is_default:
        _clear_other_defaults(tenant_id, payload.operation_kind.strip(), template_id)
    _replace_items(tenant_id, template_id, payload.items)
    return get_checklist_template(tenant_id, UUID(template_id))


def update_checklist_template(tenant_id: UUID, template_id: UUID, payload: ChecklistTemplateWrite) -> ChecklistTemplate:
    get_checklist_template(tenant_id, template_id)  # 404s before anything is written
    rows = (
        _client()
        .table("checklist_templates")
        .update(
            {
                "name": payload.name.strip(),
                "operation_kind": payload.operation_kind.strip(),
                "is_default": payload.is_default,
                "updated_at": "now()",
            }
        )
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Checklist template not found")
    if payload.is_default:
        _clear_other_defaults(tenant_id, payload.operation_kind.strip(), str(template_id))
    _replace_items(tenant_id, str(template_id), payload.items)
    return get_checklist_template(tenant_id, template_id)


def delete_checklist_template(tenant_id: UUID, template_id: UUID) -> None:
    rows = (
        _client()
        .table("checklist_templates")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(template_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Checklist template not found")


# ---------------------------------------------------------------------------
# Pipelines and their declared transitions
# ---------------------------------------------------------------------------

#: Cap on rows pulled for a count. Well past any real tenant, and it keeps a
#: pathological one from turning a settings screen into a full table scan.
_COUNT_LIMIT = 20000


def validate_pipeline(payload: PipelineWrite) -> list[dict[str, Any]]:
    """Check the stage list and the rules declared over it, return the rows.

    Every check here exists because the failure it prevents is SILENT.
    `assert_allowed` matches a transition by string equality against the deal's
    current stage, so a rule naming a stage the pipeline does not have never
    fires and never complains — it just quietly is not there.
    """
    stages = [stage.strip() for stage in payload.stages]
    if any(not stage for stage in stages):
        raise HTTPException(status_code=422, detail="stage names cannot be blank")
    if len(set(stages)) != len(stages):
        raise HTTPException(status_code=422, detail="stage names must be unique")

    known = set(stages)
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str | None, str]] = set()
    for transition in payload.transitions:
        origin = transition.from_stage.strip() if transition.from_stage else None
        target = transition.to_stage.strip()
        if not target:
            raise HTTPException(status_code=422, detail="a transition needs a destination")
        # The ORIGIN is checked against the stage list and the destination is
        # not, and the asymmetry is the point. A rule whose origin is not a real
        # stage can never match the deal sitting there, so it is dead on
        # arrival. A destination outside the list is a normal, deliberate
        # pattern: the seeded pipelines all declare `NULL → LOST`, and LOST is
        # not one of the six stages precisely because abandoning a deal takes it
        # out of the flow rather than along it.
        if origin is not None and origin not in known:
            raise HTTPException(status_code=422, detail=f"transition starts at unknown stage {origin!r}")
        if origin == target:
            # `assert_allowed` returns early when from == to, so such a row can
            # never match anything.
            raise HTTPException(status_code=422, detail=f"a transition from {target!r} to itself does nothing")
        key = (origin, target)
        if key in seen:
            raise HTTPException(status_code=422, detail=f"duplicate transition {origin} → {target}")
        seen.add(key)
        rows.append({"from_stage": origin, "to_stage": target, "requires_human": transition.requires_human})
    return rows


def _pipeline_transitions(tenant_id: UUID, pipeline_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    if not pipeline_ids:
        return {}
    rows = (
        _client()
        .table("pipeline_transitions")
        .select("pipeline_id,from_stage,to_stage,requires_human")
        .eq("tenant_id", str(tenant_id))
        .in_("pipeline_id", pipeline_ids)
        .execute()
        .data
        or []
    )
    grouped: dict[str, list[dict[str, Any]]] = {pipeline_id: [] for pipeline_id in pipeline_ids}
    for row in rows:
        grouped.setdefault(row["pipeline_id"], []).append(row)
    return grouped


def _deal_counts(tenant_id: UUID, pipeline_ids: list[str]) -> dict[str, int]:
    """How many open deals each pipeline is currently governing."""
    if not pipeline_ids:
        return {}
    rows = (
        _client()
        .table("opportunities")
        .select("pipeline_id")
        .eq("tenant_id", str(tenant_id))
        .in_("pipeline_id", pipeline_ids)
        .is_("deleted_at", "null")
        .limit(_COUNT_LIMIT)
        .execute()
        .data
        or []
    )
    counts: dict[str, int] = dict.fromkeys(pipeline_ids, 0)
    for row in rows:
        if row.get("pipeline_id"):
            counts[row["pipeline_id"]] = counts.get(row["pipeline_id"], 0) + 1
    return counts


def _to_pipeline(row: dict[str, Any], transitions: list[dict[str, Any]], deal_count: int) -> Pipeline:
    return Pipeline(
        id=row["id"],
        name=row["name"],
        stages=row.get("stages") or [],
        is_default=row.get("is_default", False),
        transitions=[
            PipelineTransition(
                from_stage=t["from_stage"],
                to_stage=t["to_stage"],
                requires_human=t["requires_human"],
            )
            for t in sorted(
                transitions, key=lambda t: (t["from_stage"] is not None, t["from_stage"] or "", t["to_stage"])
            )
        ],
        deal_count=deal_count,
    )


def list_pipelines(tenant_id: UUID) -> list[Pipeline]:
    rows = (
        _client()
        .table("pipelines")
        .select("id,name,stages,is_default")
        .eq("tenant_id", str(tenant_id))
        .order("is_default", desc=True)
        .order("name")
        .execute()
        .data
        or []
    )
    ids = [row["id"] for row in rows]
    transitions = _pipeline_transitions(tenant_id, ids)
    counts = _deal_counts(tenant_id, ids)
    return [_to_pipeline(row, transitions.get(row["id"], []), counts.get(row["id"], 0)) for row in rows]


def get_pipeline(tenant_id: UUID, pipeline_id: UUID) -> Pipeline:
    rows = (
        _client()
        .table("pipelines")
        .select("id,name,stages,is_default")
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(pipeline_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    key = str(pipeline_id)
    return _to_pipeline(
        rows[0], _pipeline_transitions(tenant_id, [key]).get(key, []), _deal_counts(tenant_id, [key]).get(key, 0)
    )


def _clear_other_default_pipelines(tenant_id: UUID, keep_id: str | None) -> None:
    query = (
        _client()
        .table("pipelines")
        .update({"is_default": False})
        .eq("tenant_id", str(tenant_id))
        .eq("is_default", True)
    )
    if keep_id:
        query = query.neq("id", keep_id)
    query.execute()


def _replace_transitions(tenant_id: UUID, pipeline_id: str, rows: list[dict[str, Any]]) -> None:
    """Wholesale replace, like the checklist items: UNIQUE (pipeline_id,
    from_stage, to_stage) makes an incremental diff a collision hazard."""
    (
        _client()
        .table("pipeline_transitions")
        .delete()
        .eq("tenant_id", str(tenant_id))
        .eq("pipeline_id", pipeline_id)
        .execute()
    )
    if not rows:
        return
    _client().table("pipeline_transitions").insert(
        [{**row, "tenant_id": str(tenant_id), "pipeline_id": pipeline_id} for row in rows]
    ).execute()


def create_pipeline(tenant_id: UUID, payload: PipelineWrite) -> Pipeline:
    transitions = validate_pipeline(payload)
    rows = (
        _client()
        .table("pipelines")
        .insert(
            {
                "tenant_id": str(tenant_id),
                "name": payload.name.strip(),
                "stages": [stage.strip() for stage in payload.stages],
                "is_default": payload.is_default,
            }
        )
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=500, detail="Pipeline was not created")
    pipeline_id = rows[0]["id"]
    if payload.is_default:
        _clear_other_default_pipelines(tenant_id, pipeline_id)
    _replace_transitions(tenant_id, pipeline_id, transitions)
    return get_pipeline(tenant_id, UUID(pipeline_id))


def update_pipeline(tenant_id: UUID, pipeline_id: UUID, payload: PipelineWrite) -> Pipeline:
    get_pipeline(tenant_id, pipeline_id)  # 404s before anything is written
    transitions = validate_pipeline(payload)
    rows = (
        _client()
        .table("pipelines")
        .update(
            {
                "name": payload.name.strip(),
                "stages": [stage.strip() for stage in payload.stages],
                "is_default": payload.is_default,
            }
        )
        .eq("tenant_id", str(tenant_id))
        .eq("id", str(pipeline_id))
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if payload.is_default:
        _clear_other_default_pipelines(tenant_id, str(pipeline_id))
    _replace_transitions(tenant_id, str(pipeline_id), transitions)
    return get_pipeline(tenant_id, pipeline_id)


def delete_pipeline(tenant_id: UUID, pipeline_id: UUID) -> None:
    rows = (
        _client().table("pipelines").delete().eq("tenant_id", str(tenant_id)).eq("id", str(pipeline_id)).execute().data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Pipeline not found")


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------


def _tag_usage(tenant_id: UUID, tag_ids: set[str]) -> dict[str, int]:
    """Counts per tag, from this tenant's taggings only.

    `taggings` is UNIQUE (tag_id, target_table, target_row_id) with no
    tenant_id in the key, so the constraint does not isolate tenants. The count
    is therefore filtered on tenant_id AND intersected with this tenant's own
    tag ids, rather than trusting either on its own.
    """
    if not tag_ids:
        return {}
    rows = (
        _client().table("taggings").select("tag_id").eq("tenant_id", str(tenant_id)).limit(_COUNT_LIMIT).execute().data
        or []
    )
    counts: dict[str, int] = dict.fromkeys(tag_ids, 0)
    for row in rows:
        tag_id = row.get("tag_id")
        if tag_id in counts:
            counts[tag_id] += 1
    return counts


def list_tags(tenant_id: UUID) -> list[Tag]:
    rows = (
        _client().table("tags").select("id,name,color").eq("tenant_id", str(tenant_id)).order("name").execute().data
        or []
    )
    usage = _tag_usage(tenant_id, {row["id"] for row in rows})
    return [Tag(**row, usage_count=usage.get(row["id"], 0)) for row in rows]


def _tag_values(payload: TagWrite) -> dict[str, Any]:
    return {"name": payload.name.strip(), "color": (payload.color or "").strip() or None}


def create_tag(tenant_id: UUID, payload: TagWrite) -> Tag:
    values = {**_tag_values(payload), "tenant_id": str(tenant_id)}
    try:
        rows = _client().table("tags").insert(values).execute().data or []
    except Exception as exc:  # UNIQUE (tenant_id, name)
        if "duplicate key" in str(exc) or "23505" in str(exc):
            raise HTTPException(status_code=409, detail="A tag with that name already exists") from exc
        raise
    if not rows:
        raise HTTPException(status_code=500, detail="Tag was not created")
    return Tag(**{k: rows[0][k] for k in ("id", "name", "color")}, usage_count=0)


def update_tag(tenant_id: UUID, tag_id: UUID, payload: TagWrite) -> Tag:
    try:
        rows = (
            _client()
            .table("tags")
            .update(_tag_values(payload))
            .eq("tenant_id", str(tenant_id))
            .eq("id", str(tag_id))
            .execute()
            .data
            or []
        )
    except Exception as exc:
        if "duplicate key" in str(exc) or "23505" in str(exc):
            raise HTTPException(status_code=409, detail="A tag with that name already exists") from exc
        raise
    if not rows:
        raise HTTPException(status_code=404, detail="Tag not found")
    usage = _tag_usage(tenant_id, {str(tag_id)})
    return Tag(**{k: rows[0][k] for k in ("id", "name", "color")}, usage_count=usage.get(str(tag_id), 0))


def delete_tag(tenant_id: UUID, tag_id: UUID) -> None:
    """Deleting a tag cascades to its taggings — the label comes off every row
    that carried it. The caller is expected to have shown the count first."""
    rows = _client().table("tags").delete().eq("tenant_id", str(tenant_id)).eq("id", str(tag_id)).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Tag not found")
