"""Unit tests for sharing service _validate_caps logic."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.features.sharing.service import (
    ALLOWED_DOC_CAPS,
    ALLOWED_VISIT_CAPS,
    _validate_caps,
)


class TestValidateDocCaps:
    def test_owner_view_only(self):
        _validate_caps({"owner": ["view"]}, ALLOWED_DOC_CAPS)

    def test_owner_and_agent(self):
        _validate_caps({"owner": ["view", "download"], "agent": ["view"]}, ALLOWED_DOC_CAPS)

    def test_empty_dict_ok(self):
        _validate_caps({}, ALLOWED_DOC_CAPS)

    def test_unknown_audience_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_caps({"hacker": ["view"]}, ALLOWED_DOC_CAPS)
        assert exc.value.status_code == 422
        assert "audience" in exc.value.detail.lower()

    def test_unknown_cap_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_caps({"owner": ["nuke"]}, ALLOWED_DOC_CAPS)
        assert exc.value.status_code == 422
        assert "nuke" in exc.value.detail

    def test_non_list_rejected(self):
        with pytest.raises(HTTPException):
            _validate_caps({"owner": "view"}, ALLOWED_DOC_CAPS)  # type: ignore[arg-type]

    def test_non_dict_rejected(self):
        with pytest.raises(HTTPException):
            _validate_caps(["owner"], ALLOWED_DOC_CAPS)  # type: ignore[arg-type]


class TestValidateVisitCaps:
    def test_full_owner_unlock(self):
        _validate_caps(
            {"owner": ["view", "view_visitor_identity", "view_visit_documents"]},
            ALLOWED_VISIT_CAPS,
        )

    def test_view_without_visitor_identity_ok(self):
        _validate_caps({"owner": ["view"]}, ALLOWED_VISIT_CAPS)

    def test_doc_cap_rejected_for_visit(self):
        with pytest.raises(HTTPException):
            _validate_caps({"owner": ["download"]}, ALLOWED_VISIT_CAPS)
