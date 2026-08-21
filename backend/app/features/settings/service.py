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
