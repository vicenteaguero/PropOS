"""Rules the assistant cannot argue with.

A prompt is a suggestion; each of these is the same rule expressed where the
model has no vote. Every one of them protects somebody who is not in the room
when the AI decides to act.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.features.agent import guards
from app.features.agent.guards import (
    GuardError,
    assert_no_date_commitment,
    assert_no_unverified_quote,
    assert_not_quiet_hours,
)

TENANT = uuid4()


class _FakeClient:
    """Enough of the PostgREST chain for the one query under test."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.not_ = self

    def table(self, _name):
        return self

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


class TestUnverifiedFigures:
    """The 120 m² the owner mentioned and the 118.4 on the certificado are not
    the same kind of fact, and an assistant stating both flat is lying about
    one of them."""

    PROPERTY = {"area_sqm": 120, "list_price_cents": None, "lot_sqm": None, "rol": None}

    def test_declared_is_refused(self) -> None:
        with pytest.raises(GuardError, match="declarado"):
            assert_no_unverified_quote({**self.PROPERTY, "provenance": {"area_sqm": {"src": "declared"}}})

    def test_unknown_provenance_is_refused(self) -> None:
        """Everything already in the table has no provenance recorded, and
        unknown must never read as verified."""
        with pytest.raises(GuardError, match="origen desconocido"):
            assert_no_unverified_quote({**self.PROPERTY, "provenance": {}})

    def test_verified_passes(self) -> None:
        assert_no_unverified_quote({**self.PROPERTY, "provenance": {"area_sqm": {"src": "verified"}}})

    def test_a_field_with_no_value_is_not_a_claim(self) -> None:
        assert_no_unverified_quote({"area_sqm": None, "provenance": {}})


class TestDateCommitments:
    def test_a_promise_is_refused(self) -> None:
        with pytest.raises(GuardError):
            assert_no_date_commitment("Perfecto, te lo envío el martes sin falta.")

    def test_mentioning_a_day_is_not_promising_one(self) -> None:
        """Refusing every sentence containing a weekday would make the assistant
        unable to answer "¿se puede visitar el martes?"."""
        assert_no_date_commitment("La visita del martes fue con otro cliente.")

    def test_a_commitment_without_a_date_is_fine(self) -> None:
        assert_no_date_commitment("Te confirmo apenas tenga la respuesta.")


class TestQuietHours:
    CONTACT = {"quiet_hours": {"from": "21:00", "to": "09:00"}}

    def test_inside_a_window_that_wraps_midnight(self) -> None:
        with pytest.raises(GuardError):
            assert_not_quiet_hours(self.CONTACT, datetime(2026, 8, 20, 23, 30, tzinfo=UTC))
        with pytest.raises(GuardError):
            assert_not_quiet_hours(self.CONTACT, datetime(2026, 8, 20, 7, 0, tzinfo=UTC))

    def test_outside_it(self) -> None:
        assert_not_quiet_hours(self.CONTACT, datetime(2026, 8, 20, 15, 0, tzinfo=UTC))

    def test_no_preference_means_no_restriction(self) -> None:
        assert_not_quiet_hours({}, datetime(2026, 8, 20, 3, 0, tzinfo=UTC))


class TestFirstContact:
    def test_the_ai_never_opens_a_relationship(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(guards, "get_supabase_client", lambda: _FakeClient([]))
        with pytest.raises(GuardError, match="primer mensaje"):
            guards.assert_not_first_contact(TENANT, str(uuid4()))

    def test_replying_to_somebody_who_wrote_first_is_fine(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            guards,
            "get_supabase_client",
            lambda: _FakeClient([{"last_inbound_at": "2026-08-20"}]),
        )
        guards.assert_not_first_contact(TENANT, str(uuid4()))


class TestConsent:
    def test_an_unidentified_thread_cannot_be_written_to(self) -> None:
        with pytest.raises(GuardError, match="no está identificada"):
            guards.assert_consent(TENANT, None)

    def test_revoked_consent_blocks(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(guards, "has_consent", lambda *_a: False)
        with pytest.raises(GuardError, match="consentimiento"):
            guards.assert_consent(TENANT, str(uuid4()))
