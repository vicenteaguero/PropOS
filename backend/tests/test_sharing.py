"""Unit tests for the sharing service: cap validation + tenant scoping."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.features.sharing.service import (
    ALLOWED_DOC_CAPS,
    ALLOWED_VISIT_CAPS,
    SharingService,
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


# ---------------------------------------------------------------- tenant scoping


class _RecordingTable:
    """Chainable Supabase stub that records the filters a query applied."""

    _VERBS = {"select", "update", "eq", "limit"}

    def __init__(self, name: str, scripts: dict, log: list):
        self.name = name
        self.scripts = scripts
        self.log = log
        self.filters: list[tuple] = []

    def __getattr__(self, item: str):
        if item not in self._VERBS:
            raise AttributeError(item)

        def apply(*args, **_kwargs):
            self.filters.append((item, args))
            return self

        return apply

    def execute(self):
        self.log.append({"table": self.name, "filters": self.filters})
        return SimpleNamespace(data=self.scripts.get(self.name, []))


class _RecordingSupabase:
    def __init__(self, scripts: dict):
        self.scripts = scripts
        self.log: list = []

    def table(self, name: str) -> _RecordingTable:
        return _RecordingTable(name, self.scripts, self.log)


TENANT = UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
ROW_ID = UUID("22222222-2222-2222-2222-222222222222")


class TestTenantScoping:
    """Audit R3, P2-07.

    Both writers run on the service-role client, which bypasses RLS. Without a
    `tenant_id` filter an admin of one tenant could flip `audience_caps` on any
    document or interaction in the database by guessing its id.
    """

    @pytest.mark.asyncio
    @patch("app.features.sharing.service.get_supabase_client")
    async def test_document_update_filters_by_tenant(self, mock_client):
        fake = _RecordingSupabase({"documents": [{"id": str(ROW_ID)}]})
        mock_client.return_value = fake

        await SharingService.set_document_sharing(ROW_ID, TENANT, {"owner": ["view"]})

        update = next(e for e in fake.log if e["table"] == "documents")
        assert ("eq", ("tenant_id", str(TENANT))) in update["filters"]

    @pytest.mark.asyncio
    @patch("app.features.sharing.service.get_supabase_client")
    async def test_document_update_404s_on_foreign_row(self, mock_client):
        """The tenant filter matches nothing, so PostgREST returns no rows."""
        mock_client.return_value = _RecordingSupabase({"documents": []})

        with pytest.raises(HTTPException) as exc:
            await SharingService.set_document_sharing(ROW_ID, TENANT, {"owner": ["view"]})
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    @patch("app.features.sharing.service.get_supabase_client")
    async def test_document_rejects_foreign_property(self, mock_client):
        """Re-pointing a document at another tenant's property is refused."""
        mock_client.return_value = _RecordingSupabase({"properties": [], "documents": [{"id": str(ROW_ID)}]})

        with pytest.raises(HTTPException) as exc:
            await SharingService.set_document_sharing(ROW_ID, TENANT, {"owner": ["view"]}, property_id=ROW_ID)
        assert exc.value.status_code == 404
        assert "Property" in exc.value.detail

    @pytest.mark.asyncio
    @patch("app.features.sharing.service.get_supabase_client")
    async def test_interaction_update_filters_by_tenant(self, mock_client):
        fake = _RecordingSupabase({"interactions": [{"id": str(ROW_ID)}]})
        mock_client.return_value = fake

        await SharingService.set_interaction_sharing(ROW_ID, TENANT, {"owner": ["view"]})

        update = next(e for e in fake.log if e["table"] == "interactions")
        assert ("eq", ("tenant_id", str(TENANT))) in update["filters"]

    @pytest.mark.asyncio
    @patch("app.features.sharing.service.get_supabase_client")
    async def test_interaction_update_404s_on_foreign_row(self, mock_client):
        mock_client.return_value = _RecordingSupabase({"interactions": []})

        with pytest.raises(HTTPException) as exc:
            await SharingService.set_interaction_sharing(ROW_ID, TENANT, {"owner": ["view"]})
        assert exc.value.status_code == 404
