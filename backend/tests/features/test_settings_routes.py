"""The catalog editors: route order, placeholder maths, and item ordering.

Route order is tested for the same reason `test_contacts_routes.py` exists —
FastAPI matches by declaration position, so a literal path that lands after a
uuid parameter is silently parsed as that parameter and every call 422s. The
code looks correct either way; only the order is wrong.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.features.settings.router import router
from app.features.settings.schemas import (
    ApprovalStatus,
    ChecklistItemWrite,
    MessageTemplateWrite,
)
from app.features.settings.service import (
    normalize_items,
    placeholders_in,
    resolve_approval,
    validate_variables,
)


def _paths_in_order() -> list[str]:
    return [route.path for route in router.routes]


def test_checklist_literal_list_is_declared_before_the_uuid_route() -> None:
    paths = _paths_in_order()
    catch_all = paths.index("/settings/checklist-templates/{template_id}")
    assert paths.index("/settings/checklist-templates") < catch_all


def test_message_template_literal_list_is_declared_before_the_uuid_route() -> None:
    paths = _paths_in_order()
    catch_all = paths.index("/settings/message-templates/{template_id}")
    assert paths.index("/settings/message-templates") < catch_all


# --- placeholders ----------------------------------------------------------


def test_placeholders_are_deduplicated_and_sorted() -> None:
    assert placeholders_in("Hola {{2}}, {{1}} y otra vez {{2}}") == [1, 2]


def test_placeholders_tolerate_inner_whitespace() -> None:
    assert placeholders_in("Hola {{ 1 }}") == [1]


def test_body_without_placeholders_needs_no_variables() -> None:
    validate_variables("Gracias por escribirnos.", [])


def test_variable_count_must_match_placeholder_count() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_variables("Hola {{1}}, tu visita a {{2}}", ["contact_name"])
    assert exc.value.status_code == 422


def test_placeholders_must_start_at_one_without_gaps() -> None:
    # Meta substitutes by position; a body that jumps from {{1}} to {{3}} puts
    # the second value nowhere.
    with pytest.raises(HTTPException):
        validate_variables("Hola {{1}} en {{3}}", ["a", "b"])


def test_variable_names_must_be_unique() -> None:
    with pytest.raises(HTTPException):
        validate_variables("{{1}} {{2}}", ["name", "name"])


def test_blank_variable_names_are_refused() -> None:
    with pytest.raises(HTTPException):
        validate_variables("Hola {{1}}", ["  "])


# --- approval ---------------------------------------------------------------


def _payload(**over) -> MessageTemplateWrite:
    base = dict(
        name="visit_confirmation",
        body="Hola {{1}}",
        variables=["contact_name"],
        approval_status=ApprovalStatus.APPROVED,
    )
    return MessageTemplateWrite(**{**base, **over})


_STORED = {
    "name": "visit_confirmation",
    "body": "Hola {{1}}",
    "variables": ["contact_name"],
    "category": "utility",
    "language": "es",
    "approval_status": "approved",
    "approved_at": "2026-01-01T00:00:00Z",
}


def test_editing_an_approved_body_drops_it_back_to_draft() -> None:
    status, approved_at = resolve_approval(_payload(body="Hola {{1}}, cambio"), _STORED)
    assert status is ApprovalStatus.DRAFT
    assert approved_at is None


def test_untouched_approved_template_keeps_its_approval_timestamp() -> None:
    status, approved_at = resolve_approval(_payload(), _STORED)
    assert status is ApprovalStatus.APPROVED
    assert approved_at == "2026-01-01T00:00:00Z"


def test_renaming_variables_also_invalidates_the_approval() -> None:
    status, _ = resolve_approval(_payload(variables=["nombre"]), _STORED)
    assert status is ApprovalStatus.DRAFT


def test_a_draft_is_free_to_change() -> None:
    stored = {**_STORED, "approval_status": "draft", "approved_at": None}
    status, _ = resolve_approval(_payload(body="otro texto", approval_status=ApprovalStatus.DRAFT), stored)
    assert status is ApprovalStatus.DRAFT


def test_an_explicit_status_change_is_honoured_over_the_reset() -> None:
    # Marking a rejected template as approved by hand must not be undone by the
    # edit-invalidates-approval rule.
    stored = {**_STORED, "approval_status": "rejected", "approved_at": None}
    status, approved_at = resolve_approval(_payload(), stored)
    assert status is ApprovalStatus.APPROVED
    assert approved_at == "now()"


# --- checklist items --------------------------------------------------------


def _item(title: str, **over) -> ChecklistItemWrite:
    return ChecklistItemWrite(title=title, **over)


def test_items_are_renumbered_from_one_in_array_order() -> None:
    rows = normalize_items([_item("Estudio de títulos"), _item("Tasación"), _item("Escritura")])
    assert [row["position"] for row in rows] == [1, 2, 3]
    assert [row["title"] for row in rows] == ["Estudio de títulos", "Tasación", "Escritura"]


def test_blank_optional_strings_become_null() -> None:
    rows = normalize_items([_item("Tasación", description="   ", owner_role="", document_kind=" ")])
    assert rows[0]["description"] is None
    assert rows[0]["owner_role"] is None
    assert rows[0]["document_kind"] is None


def test_blocking_survives_the_renumber() -> None:
    rows = normalize_items([_item("Aviso", blocking=False), _item("Escritura", blocking=True)])
    assert [row["blocking"] for row in rows] == [False, True]


def test_an_empty_list_normalizes_to_nothing() -> None:
    assert normalize_items([]) == []
