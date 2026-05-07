"""Deterministic Anita test seed.

Inserts a known fixture set into the configured Supabase DB scoped to a
test tenant_id (random per session — `cleanup()` deletes by tenant_id).

Expected counts/values are exposed as module constants so tests can
assert against them without re-querying.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

# Re-use the project's supabase client. Tests rely on SUPABASE_URL +
# SUPABASE_SERVICE_ROLE_KEY pointing at a local stack (54321/54322).
from app.core.supabase.client import get_supabase_client


# ── Expected counts (assert against these) ──────────────────────────

EXPECTED_PEOPLE = 5
EXPECTED_PROPERTIES_AVAILABLE = 1
EXPECTED_PROPERTIES_RESERVED = 1
EXPECTED_PROPERTIES_SOLD = 1
EXPECTED_PROJECTS = 2
EXPECTED_ORGS = 2
EXPECTED_INTERACTIONS = 4
EXPECTED_OPEN_TASKS = 3
EXPECTED_PROPERTIES_NO_RECENT_INTERACTION = 2


@dataclass
class SeedHandles:
    tenant_id: UUID
    user_id: UUID
    person_ids: dict[str, UUID] = field(default_factory=dict)
    property_ids: dict[str, UUID] = field(default_factory=dict)
    project_ids: dict[str, UUID] = field(default_factory=dict)
    org_ids: dict[str, UUID] = field(default_factory=dict)


def _now_iso(offset_days: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(days=offset_days)).isoformat()


def seed(tenant_name: str | None = None) -> SeedHandles:
    """Insert deterministic fixtures and return their IDs.

    Bypasses RLS via the service-role client. Caller is responsible for
    cleanup via `cleanup(handles)`.
    """
    if not os.environ.get("SUPABASE_URL"):
        raise RuntimeError("seed() needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env")

    client = get_supabase_client()
    tenant_id = uuid4()
    user_id = uuid4()

    # propos_test.tenants is its own table (LIKE public.tenants — same
    # `tenant_slug` enum, but the UNIQUE applies only within propos_test).
    # `cleanup()` deletes the row at end-of-session.
    client.table("tenants").insert(
        {
            "id": str(tenant_id),
            "name": tenant_name or f"Anita Test {tenant_id.hex[:6]}",
            "slug": "anaida",
        }
    ).execute()
    handles = SeedHandles(tenant_id=tenant_id, user_id=user_id)

    # ── People ──
    people_specs = [
        ("juan_perez", "Juan Pérez", "BUYER", "11.111.111-1"),
        ("maria_soto_seller", "María Soto", "SELLER", "22.222.222-2"),
        ("maria_lopez_buyer", "María López", "BUYER", "33.333.333-3"),
        ("pedro_kast", "Pedro Kast", "INVESTOR", "44.444.444-4"),
        ("ana_rojas", "Ana Rojas", "LANDOWNER", "55.555.555-5"),
    ]
    rows = [
        {
            "id": str(uuid4()),
            "tenant_id": str(tenant_id),
            "full_name": name,
            "type": kind,
            "is_draft": False,
        }
        for _, name, kind, _ in people_specs
    ]
    client.table("contacts").insert(rows).execute()
    for (key, _, _, _), row in zip(people_specs, rows, strict=True):
        handles.person_ids[key] = UUID(row["id"])

    # ── Properties ──
    props_specs = [
        ("casa_apoquindo", "Casa Apoquindo 1234", "Av. Apoquindo 1234, Las Condes", "AVAILABLE"),
        ("depto_providencia", "Depto Providencia 567", "Av. Providencia 567", "RESERVED"),
        ("parcela_chicureo", "Parcela Chicureo 89", "Camino Chicureo 89", "SOLD"),
    ]
    rows = [
        {
            "id": str(uuid4()),
            "tenant_id": str(tenant_id),
            "title": title,
            "address": addr,
            "status": status,
            "is_draft": False,
        }
        for _, title, addr, status in props_specs
    ]
    client.table("properties").insert(rows).execute()
    for (key, *_), row in zip(props_specs, rows, strict=True):
        handles.property_ids[key] = UUID(row["id"])

    # ── Projects ──
    proj_specs = [
        ("edificio_centro", "Edificio Centro"),
        ("loteo_chicureo", "Loteo Chicureo Norte"),
    ]
    rows = [{"id": str(uuid4()), "tenant_id": str(tenant_id), "name": name} for _, name in proj_specs]
    try:
        client.table("projects").insert(rows).execute()
        for (key, _), row in zip(proj_specs, rows, strict=True):
            handles.project_ids[key] = UUID(row["id"])
    except Exception:
        # `projects` schema may have required cols; tests that don't depend
        # on projects still work.
        pass

    # ── Organizations ──
    org_specs = [
        ("notaria_uno", "Notaría Primera de Las Condes", "NOTARY"),
        ("portal_yapo", "Yapo.cl", "PORTAL"),
    ]
    rows = [
        {"id": str(uuid4()), "tenant_id": str(tenant_id), "name": name, "kind": kind} for _, name, kind in org_specs
    ]
    try:
        client.table("organizations").insert(rows).execute()
        for (key, _, _), row in zip(org_specs, rows, strict=True):
            handles.org_ids[key] = UUID(row["id"])
    except Exception:
        pass

    # ── Interactions (only on casa_apoquindo, last 1d/3d/12d/14d) ──
    casa_id = str(handles.property_ids["casa_apoquindo"])
    juan_id = str(handles.person_ids["juan_perez"])
    interactions = [
        ("VISIT", -1, "Visita reciente"),
        ("CALL", -3, "Llamada de seguimiento"),
        ("EMAIL", -12, "Email primer contacto"),
        ("MEETING", -14, "Reunión inicial"),
    ]
    rows: list[dict[str, Any]] = []
    for kind, days_offset, summary in interactions:
        rows.append(
            {
                "id": str(uuid4()),
                "tenant_id": str(tenant_id),
                "kind": kind,
                "occurred_at": _now_iso(days_offset),
                "summary": summary,
                "source": "manual",
            }
        )
    interaction_rows = client.table("interactions").insert(rows).execute().data
    # Wire to property + person via interaction_targets / participants
    for ir in interaction_rows:
        try:
            client.table("interaction_targets").insert(
                {
                    "tenant_id": str(tenant_id),
                    "interaction_id": ir["id"],
                    "target_kind": "PROPERTY",
                    "property_id": casa_id,
                }
            ).execute()
            client.table("interaction_participants").insert(
                {
                    "tenant_id": str(tenant_id),
                    "interaction_id": ir["id"],
                    "person_id": juan_id,
                }
            ).execute()
        except Exception:
            pass

    # ── Tasks (3 open, 1 of them overdue) ──
    tasks = [
        ("Llamar a Juan Pérez", "OPEN", -2),
        ("Preparar contrato Apoquindo", "OPEN", 3),
        ("Revisar publicación Yapo", "IN_PROGRESS", 5),
    ]
    rows = [
        {
            "id": str(uuid4()),
            "tenant_id": str(tenant_id),
            "kind": "TODO",
            "title": title,
            "status": status,
            "due_at": _now_iso(due_offset),
            "source": "manual",
        }
        for title, status, due_offset in tasks
    ]
    client.table("tasks").insert(rows).execute()

    return handles


def cleanup(handles: SeedHandles) -> None:
    """Hard-delete every row scoped to the seed tenant. Idempotent."""
    client = get_supabase_client()
    tenant = str(handles.tenant_id)
    tables = [
        "interaction_participants",
        "interaction_targets",
        "interactions",
        "tasks",
        "projects",
        "organizations",
        "properties",
        "contacts",
        "anita_messages",
        "anita_transcripts",
        "anita_sessions",
        "pending_proposals",
    ]
    for t in tables:
        try:
            client.table(t).delete().eq("tenant_id", tenant).execute()
        except Exception:
            pass
    try:
        client.table("tenants").delete().eq("id", tenant).execute()
    except Exception:
        pass
