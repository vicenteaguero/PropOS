"""The sentence a Pendientes card leads with.

It used to be a per-intent f-string in the dispatcher, so the queue said
"Crear tarea" and "actualizar contacto" — the KIND of action, never what it
would do or to whom. A broker had to open every card to learn anything.
"""

from __future__ import annotations

from uuid import uuid4

from app.features.agent.resolver import Candidate, FieldResolution, ResolvedFields
from app.features.agent.summaries import _ES, build_summary_es


def resolved(person: str | None = None, prop: str | None = None, *, raw: str | None = None):
    """A resolver result: `raw` is what was said, the candidate is the match."""
    return ResolvedFields(
        person=(
            FieldResolution(
                raw=raw or person or "",
                candidates=[Candidate(id=uuid4(), label=person, score=1.0)] if person else [],
            )
            if (person or raw)
            else None
        ),
        property=(
            FieldResolution(raw=prop, candidates=[Candidate(id=uuid4(), label=prop, score=1.0)]) if prop else None
        ),
    )


def test_a_task_names_the_person_and_says_what_it_is_about() -> None:
    out = build_summary_es(
        "create_task",
        {"title": "Responder", "summary": "responder a Catalina si podemos ayudarla con el crédito"},
        resolved(person="Catalina Rojas"),
    )
    assert out == ("Crear tarea para Catalina Rojas — Responder a Catalina si podemos ayudarla con el crédito")


def test_an_update_names_the_person_and_the_change() -> None:
    out = build_summary_es(
        "update_person",
        {"full_name": "Bárbara Ramos", "summary": "ahora trabaja a honorarios"},
        resolved(person="Bárbara Ramos"),
    )
    assert out == "Actualizar Bárbara Ramos: Ahora trabaja a honorarios"


def test_an_update_without_a_clause_still_says_what_changed() -> None:
    out = build_summary_es(
        "update_person",
        {"full_name": "Bárbara Ramos", "phone": "+56911111111", "email": "b@x.cl"},
        resolved(person="Bárbara Ramos"),
    )
    assert out == "Actualizar Bárbara Ramos: teléfono y correo"


def test_the_resolved_name_beats_what_the_broker_said() -> None:
    """The card is read against the database, so it uses the database's name."""
    out = build_summary_es("create_task", {"title": "Llamar"}, resolved(person="Catalina Rojas", raw="la Catalina"))
    assert "Catalina Rojas" in out
    assert "la Catalina" not in out


def test_a_silent_model_still_produces_a_sentence() -> None:
    """No `summary` at all — the verb and the subject are ours, not the model's."""
    out = build_summary_es("create_task", {"title": "Revisar planos"}, resolved(person="Juan Pérez"))
    assert out == "Crear tarea para Juan Pérez — Revisar planos"


def test_a_label_shaped_summary_is_not_treated_as_detail() -> None:
    """ "tarea" is what the old fallbacks produced; it must not become the line."""
    out = build_summary_es("create_task", {"title": "Revisar planos", "summary": "tarea"}, resolved())
    assert out == "Crear tarea — Revisar planos"


def test_an_event_names_the_kind_in_spanish() -> None:
    out = build_summary_es("create_event", {"kind": "VISIT"}, resolved(person="Ana Soto", prop="Depto 2D Ñuñoa"))
    assert out == "Agendar visita con Ana Soto en Depto 2D Ñuñoa"


def test_a_transaction_says_direction_amount_and_reason() -> None:
    out = build_summary_es("log_transaction", {"direction": "OUT", "amount": 50000, "category": "AD_SPEND"}, None)
    assert out == "Registrar egreso de $50.000 por publicidad"


def test_a_person_carries_their_role() -> None:
    out = build_summary_es("create_person", {"full_name": "Pedro Soto", "kind": "BUYER"}, None)
    assert out == "Crear contacto Pedro Soto (comprador)"


def test_an_unmapped_intent_still_names_its_subject() -> None:
    out = build_summary_es("some_new_intent", {}, resolved(person="Ana Soto"))
    assert "Ana Soto" in out


def test_the_spanish_labels_match_the_frontend_registry() -> None:
    """These four maps are a copy of `frontend/src/shared/lib/labels.ts`.

    There is no backend label registry to import from, and this string is
    composed server-side but read by a human — so the words have to exist here
    too. Pinning them means a rename on one side fails loudly rather than
    showing a broker a raw enum value on the busiest screen in the app.
    """
    from pathlib import Path

    ts = (Path(__file__).resolve().parents[4] / "frontend" / "src" / "shared" / "lib" / "labels.ts").read_text(
        encoding="utf-8"
    )

    for kind, mapping in _ES.items():
        for value, spanish in mapping.items():
            assert f'{value}: "{spanish}"' in ts, f"{kind}.{value} drifted from labels.ts"
