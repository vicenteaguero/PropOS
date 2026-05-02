"""Deterministic dispatch of intents → domain ops.

Takes the classifier intent + resolver output and either:
- writes to ``pending_proposals`` via the existing
  ``executors._create_proposal`` helper
- runs an analytics query (views or text-to-SQL)
- returns a ``clarify`` event when ambiguity blocks progress
- returns ``out_of_scope`` when nothing actionable was inferred

Zero LLM calls. The classifier's job ends before this point.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.features.anita.resolver import ResolvedFields
from app.features.anita.tools.executors import _create_proposal


def _intent_to_proposal_kind(intent: str) -> tuple[str, str] | None:
    """Map intent → (proposal_kind, target_table)."""
    return {
        "log_interaction":     ("propose_log_interaction",     "interactions"),
        "create_person":       ("propose_create_person",       "contacts"),
        "create_task":         ("propose_create_task",         "tasks"),
        "log_transaction":     ("propose_log_transaction",     "transactions"),
        "create_organization": ("propose_create_organization", "organizations"),
        "add_note":            ("propose_add_note",            "notes"),
    }.get(intent)


def _build_payload(intent: str, resolved: ResolvedFields) -> dict[str, Any]:
    """Translate the classifier extras + resolved IDs into a proposal payload
    matching ``tools/inputs.py`` Pydantic models."""
    extras = dict(resolved.extras)
    payload: dict[str, Any] = {}

    # Common fields that flow through verbatim.
    for k in ("kind", "summary", "summary_es", "task_title", "title", "due_at",
              "duration_min", "duration_minutes", "direction", "category",
              "amount_clp", "amount", "channel", "currency", "rut", "email",
              "phone", "notes", "body", "name", "full_name", "reason",
              "view", "sql", "intent_text"):
        if k in extras:
            payload[k] = extras.pop(k)

    # Compatibility shims for our Pydantic input shapes.
    if "duration_min" in payload:
        payload["duration_minutes"] = payload.pop("duration_min")
    if "amount_clp" in payload:
        payload["amount"] = payload.pop("amount_clp")
    if "summary_es" not in payload and "summary" in payload:
        payload["summary_es"] = payload["summary"]

    # Per-intent required fields.
    if intent == "log_interaction":
        if resolved.person and resolved.person.resolved_id:
            payload["participant_person_ids"] = [str(resolved.person.resolved_id)]
        if resolved.property and resolved.property.resolved_id:
            payload["property_id"] = str(resolved.property.resolved_id)
        if resolved.project and resolved.project.resolved_id:
            payload["project_id"] = str(resolved.project.resolved_id)
        payload.setdefault("kind", "NOTE")
        payload.setdefault("summary", "interacción registrada")
        payload.setdefault("summary_es", payload["summary"])

    elif intent == "create_person":
        if "full_name" not in payload:
            payload["full_name"] = resolved.person.raw if resolved.person else ""
        payload.setdefault("kind", "OTHER")
        payload.setdefault("summary_es", f"crear contacto {payload.get('full_name', '?')}")

    elif intent == "create_task":
        title = payload.pop("task_title", None) or payload.pop("title", None) or extras.get("summary") or "tarea"
        payload["title"] = title
        payload.setdefault("kind", "TODO")
        payload.setdefault("summary_es", title)

    elif intent == "log_transaction":
        payload.setdefault("currency", "CLP")
        payload.setdefault("summary_es", f"transacción {payload.get('direction', '?')} {payload.get('amount', '?')}")
        if resolved.project and resolved.project.resolved_id:
            payload["related_project_id"] = str(resolved.project.resolved_id)
        if resolved.property and resolved.property.resolved_id:
            payload["related_property_id"] = str(resolved.property.resolved_id)

    elif intent == "create_organization":
        payload.setdefault("name", payload.pop("name", "") or (resolved.org.raw if resolved.org else ""))
        payload.setdefault("kind", "OTHER")
        payload.setdefault("summary_es", f"crear organización {payload.get('name', '?')}")

    elif intent == "add_note":
        payload.setdefault("body", payload.pop("body", None) or extras.get("summary") or "nota")
        payload.setdefault("summary_es", payload["body"][:80])

    return payload


def dispatch(
    intent: str,
    resolved: ResolvedFields,
    *,
    tenant_id: UUID,
    user_id: UUID,
    session_id: UUID,
) -> dict[str, Any]:
    """Run one intent. Returns a uniform shape consumed by ``chat.run_chat_turn``::

      {kind, ...} where kind ∈ {"proposal", "query", "clarify", "out_of_scope"}.
    """
    if intent == "out_of_scope":
        return {"kind": "out_of_scope", "message": "No identifiqué una acción clara. ¿Podés repetirlo?"}

    if intent == "ambiguous":
        return {
            "kind": "clarify",
            "reason": resolved.extras.get("reason", "")
                      or "el clasificador marcó ambigüedad",
            "candidates": resolved.ambiguity_summary,
        }

    if intent in ("query_count", "query_freeform"):
        return _dispatch_query(intent, resolved, tenant_id)

    if resolved.is_ambiguous:
        return {
            "kind": "clarify",
            "reason": "Hay más de un candidato; necesito que confirmes cuál.",
            "candidates": resolved.ambiguity_summary,
        }

    spec = _intent_to_proposal_kind(intent)
    if spec is None:
        return {"kind": "out_of_scope", "message": f"intent desconocido: {intent}"}

    proposal_kind, target_table = spec
    payload = _build_payload(intent, resolved)

    result = _create_proposal(
        kind=proposal_kind,
        payload=payload,
        target_table=target_table,
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
    )
    # `_create_proposal` returns its own `kind` (e.g. "propose_log_interaction").
    # Overwrite outcome.kind with the high-level shape so chat.py can branch.
    return {**result, "kind": "proposal", "proposal_kind": result.get("kind")}


def _dispatch_query(intent: str, resolved: ResolvedFields, tenant_id: UUID) -> dict[str, Any]:
    """Run analytics tools without involving the LLM."""
    from app.features.anita.tools.query_data import run_query

    if intent == "query_count":
        view = resolved.extras.get("view")
        if not view:
            return {"kind": "clarify", "reason": "falta `view` para query_count"}
        result = run_query({"view": view, "filters": {}}, tenant_id)
        return {"kind": "query", "tool": "query_views", "result": result}

    # query_freeform: classifier doesn't write SQL — escalate to a small
    # follow-up LLM call (handled by chat.py orchestrator) or punt for now.
    return {
        "kind": "needs_sql",
        "intent_text": resolved.extras.get("intent_text") or resolved.extras.get("summary") or "",
    }
