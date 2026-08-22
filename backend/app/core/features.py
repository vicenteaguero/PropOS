"""The catalog of switchable features, and how a tenant's state resolves.

One list, in one place. The frontend mirrors the keys (`shared/feature/catalog.ts`)
and a test asserts the two agree, because a key that exists on only one side is
a switch that appears to do nothing.

A key is not the same thing as an `admin_scope` value even where the strings
match. The scope answers "may this person?", the feature state answers "is this
finished?" -- see the migration `..._feature_states.sql`. Most keys carry the
scope they pair with so a caller can ask both questions at once.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any
from uuid import UUID

from app.core.supabase.client import get_supabase_client

TABLE = "feature_states"

#: The sentinel the unique index uses for "applies to every tenant".
GLOBAL_SCOPE = "00000000-0000-0000-0000-000000000000"


class FeatureState(str, Enum):
    ON = "on"
    WIP = "wip"
    LOCKED = "locked"
    HIDDEN = "hidden"


#: States that refuse at the API. `wip` deliberately does not: a work-in-progress
#: feature is one you want people to actually exercise.
BLOCKING_STATES = (FeatureState.LOCKED, FeatureState.HIDDEN)


@dataclass(frozen=True)
class Feature:
    key: str
    label_es: str
    #: The `admin_scope` value this feature pairs with, when there is one.
    scope: str | None = None
    default_state: FeatureState = FeatureState.ON


CATALOG: tuple[Feature, ...] = (
    Feature("agent", "Propo", scope="agent"),
    Feature("propo_voz", "Propo por voz", scope="agent"),
    Feature("pendientes", "Pendientes", scope="pendientes"),
    Feature("crm", "Personas y negocios", scope="crm"),
    Feature("conversaciones", "Conversaciones"),
    Feature("inbox", "Bandeja de WhatsApp", scope="inbox"),
    Feature("email", "Bandeja de correo", scope="email"),
    Feature("productividad", "Agenda, tareas y notas", scope="productividad"),
    Feature("documents", "Documentos", scope="documents"),
    Feature("propiedades", "Propiedades"),
    Feature("portales", "Publicación en portales"),
    Feature("finanzas", "Finanzas", scope="finanzas"),
    Feature("analytics", "Analítica", scope="analytics"),
    Feature("datos", "Importar datos", scope="datos"),
    Feature("phones", "Teléfonos", scope="phones"),
    Feature("workflows", "Workflows", scope="workflows"),
    Feature("uso", "Uso de la app"),
)

BY_KEY: dict[str, Feature] = {f.key: f for f in CATALOG}
KEYS: tuple[str, ...] = tuple(f.key for f in CATALOG)


def _client():
    return get_supabase_client()


def resolve_states(tenant_id: UUID | str) -> dict[str, dict[str, Any]]:
    """Every key's effective state for one tenant.

    Precedence: the tenant's own row, then the global default row, then the
    catalog default. A key with no row anywhere is `on` -- a feature nobody has
    ever touched should behave exactly as it did before this table existed.
    """
    resolved: dict[str, dict[str, Any]] = {f.key: {"state": f.default_state.value, "note": None} for f in CATALOG}

    rows = (
        _client()
        .table(TABLE)
        .select("tenant_id,key,state,note")
        .or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
        .execute()
        .data
        or []
    )

    # Globals first so a tenant row lands on top of one.
    for row in sorted(rows, key=lambda r: r.get("tenant_id") is not None):
        key = row["key"]
        if key not in resolved:
            continue  # a key retired from the catalog; the row is inert
        resolved[key] = {"state": row["state"], "note": row.get("note")}
    return resolved


def state_for(tenant_id: UUID | str, key: str) -> FeatureState:
    entry = resolve_states(tenant_id).get(key)
    if not entry:
        return FeatureState.ON
    return FeatureState(entry["state"])


def set_state(
    key: str,
    state: FeatureState,
    *,
    tenant_id: UUID | str | None,
    note: str | None,
    updated_by: UUID | str | None,
) -> dict[str, Any]:
    """Upsert one row. `tenant_id=None` writes the global default."""
    row = {
        "tenant_id": str(tenant_id) if tenant_id else None,
        "key": key,
        "state": state.value,
        "note": note,
        "updated_by": str(updated_by) if updated_by else None,
        "updated_at": "now()",
    }
    existing = _client().table(TABLE).select("id").eq("key", key)
    existing = existing.is_("tenant_id", "null") if tenant_id is None else existing.eq("tenant_id", str(tenant_id))
    found = existing.limit(1).execute().data
    if found:
        # Not `upsert(on_conflict=...)`: the uniqueness lives in a functional
        # index over COALESCE(tenant_id, sentinel), and PostgREST can only name
        # plain columns in on_conflict.
        return _client().table(TABLE).update(row).eq("id", found[0]["id"]).execute().data[0]
    return _client().table(TABLE).insert(row).execute().data[0]
