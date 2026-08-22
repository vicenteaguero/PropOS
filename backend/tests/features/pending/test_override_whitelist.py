"""What a reviewer is allowed to change before accepting a proposal.

`accept_proposal` used to merge the request body into the payload with a bare
`payload.update(overrides)`, and that payload becomes the row an executor
inserts. Any key at all reached the database — `tenant_id`, `id`, a column from
another table entirely. The queue exists because the model is not trusted; the
review must not be a way around that.
"""

from __future__ import annotations

import pytest

from app.features.pending.overrides import OverrideError, sanitize_overrides

TASK = "propose_create_task"
PERSON = "propose_create_person"


def test_a_declared_field_passes_through() -> None:
    assert sanitize_overrides(TASK, {"title": "Llamar a Catalina"}) == {"title": "Llamar a Catalina"}


def test_an_alias_is_normalised_to_the_canonical_name() -> None:
    """The classifier's vocabulary and the column name are not the same word."""
    assert sanitize_overrides(TASK, {"task_title": "Llamar"}) == {"title": "Llamar"}


@pytest.mark.parametrize("key", ["tenant_id", "id", "created_by", "deleted_at", "role"])
def test_a_column_the_intent_never_declared_is_refused(key: str) -> None:
    with pytest.raises(OverrideError) as exc:
        sanitize_overrides(TASK, {key: "x"})
    assert key in exc.value.args[0]


def test_an_unknown_kind_cannot_be_corrected_at_all() -> None:
    """No declaration means no way to know which columns are safe."""
    with pytest.raises(OverrideError):
        sanitize_overrides("propose_something_new", {"title": "x"})


def test_an_emptied_field_means_leave_it_not_write_empty() -> None:
    """Executors treat a present-but-blank column as a real write."""
    assert sanitize_overrides(TASK, {"title": "  ", "description": None}) == {}


def test_text_is_trimmed_and_capped() -> None:
    out = sanitize_overrides(PERSON, {"full_name": "  Catalina Rojas  ", "notes": "x" * 5000})
    assert out["full_name"] == "Catalina Rojas"
    assert len(out["notes"]) == 2000


def test_a_nested_object_is_refused() -> None:
    """Nothing in the registry declares a dict-shaped field, so one here is an
    attempt to smuggle structure past the executor."""
    with pytest.raises(OverrideError):
        sanitize_overrides(PERSON, {"full_name": {"$ne": None}})


def test_no_overrides_is_not_an_error() -> None:
    assert sanitize_overrides(TASK, None) == {}
    assert sanitize_overrides(TASK, {}) == {}
