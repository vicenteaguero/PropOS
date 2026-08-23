from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.db import run_blocking
from app.core.supabase.client import get_supabase_client
from app.features.opportunities.transitions import assert_allowed

#: Stages at which a deal becomes an expediente. Named here rather than guessed
#: from position: a pipeline can have any stage names, and "the one before the
#: last" is not a rule anybody wrote down.
AGREEMENT_STAGES = frozenset({"RESERVATION", "OFFER_ACCEPTED", "ACUERDO"})

OPP_TABLE = "opportunities"
HISTORY_TABLE = "opportunity_stage_history"


def _norm(data: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, datetime | date):
            out[k] = v.isoformat()
        elif isinstance(v, UUID):
            out[k] = str(v)
        else:
            out[k] = v
    if "status" in out and hasattr(out["status"], "value"):
        out["status"] = out["status"].value
    return out


def _count_of(embed: Any) -> int:
    """PostgREST returns an embedded `count` as `[{"count": n}]`, or `[]`."""
    if isinstance(embed, list) and embed:
        return int(embed[0].get("count") or 0)
    return 0


def _flatten_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Turn the embedded counts into plain numbers the response model declares.

    Reported as EXTRAS, not totals: the card already names the principal person
    and property, so "+1" has to mean "one more than the one you can see". A
    deal with a single participant contributes nothing.
    """
    for row in rows:
        participants = _count_of(row.pop("opportunity_participants", None))
        properties = _count_of(row.pop("opportunity_properties", None))
        row["extra_participants"] = max(0, participants - 1)
        row["extra_properties"] = max(0, properties - 1)
    return rows


def _attach_comunas(client, tenant_id: UUID, rows: list[dict]) -> None:
    """Attach `comunas`: every comuna this deal touches, in place.

    A deal is not about one property. `property_id` is the principal, and
    `opportunity_properties` holds the rest — so a comuna filter that read only
    `property_id` missed the half of a broker's book where the buyer is looking
    at three flats in two neighbourhoods.

    Two bounded reads for the whole page, not one per deal. Best-effort: a
    board with no comunas is a board without one filter, a board that 500s is
    no board.
    """
    if not rows:
        return
    ids = [r["id"] for r in rows]
    try:
        links = (
            client.table("opportunity_properties")
            .select("opportunity_id,property_id")
            .eq("tenant_id", str(tenant_id))
            .in_("opportunity_id", ids)
            .execute()
            .data
            or []
        )
    except Exception:  # noqa: BLE001
        links = []

    by_opp: dict[str, set[str]] = {}
    for row in rows:
        principal = row.get("property_id")
        if principal:
            by_opp.setdefault(row["id"], set()).add(principal)
    for link in links:
        if link.get("property_id"):
            by_opp.setdefault(link["opportunity_id"], set()).add(link["property_id"])

    wanted = {pid for pids in by_opp.values() for pid in pids}
    comunas: dict[str, str] = {}
    if wanted:
        try:
            props = (
                client.table("properties")
                .select("id,comuna")
                .eq("tenant_id", str(tenant_id))
                .in_("id", list(wanted))
                .execute()
                .data
                or []
            )
            comunas = {p["id"]: p["comuna"] for p in props if p.get("comuna")}
        except Exception:  # noqa: BLE001
            comunas = {}

    for row in rows:
        names = {comunas[pid] for pid in by_opp.get(row["id"], set()) if pid in comunas}
        row["comunas"] = sorted(names)


class OpportunityService:
    @staticmethod
    async def list_opportunities(
        tenant_id: UUID,
        status: str | None = None,
        stage: str | None = None,
        person_id: UUID | None = None,
        property_id: UUID | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[dict]:
        # Off the event loop: the Supabase client is synchronous, so an
        # inline round trip holds the whole worker for its duration.
        def _read() -> list[dict]:
            client = get_supabase_client()
            # Count the extra participants and properties so a card can say a deal
            # has more than the one person and one property it names. Half the deals
            # in a real book do, and `person_id`/`property_id` are only the
            # principal — the card silently claimed a two-buyer deal was a one-buyer
            # deal. `count="exact"` on the embed returns the count without the rows.
            builder = (
                client.table(OPP_TABLE)
                .select("*, opportunity_participants(count), opportunity_properties(count)")
                .eq("tenant_id", str(tenant_id))
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
            )
            if status:
                builder = builder.eq("status", status)
            if stage:
                builder = builder.eq("pipeline_stage", stage)
            if person_id:
                builder = builder.eq("person_id", str(person_id))
            if property_id:
                builder = builder.eq("property_id", str(property_id))
            rows = _flatten_counts(builder.execute().data or [])
            _attach_comunas(client, tenant_id, rows)
            return rows

        return await run_blocking(_read)

    @staticmethod
    async def get_opportunity(opp_id: UUID, tenant_id: UUID) -> dict:
        client = get_supabase_client()
        return (
            client.table(OPP_TABLE)
            .select("*")
            .eq("id", str(opp_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )

    @staticmethod
    async def get_history(opp_id: UUID, tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table(HISTORY_TABLE)
            .select("*")
            .eq("opportunity_id", str(opp_id))
            .eq("tenant_id", str(tenant_id))
            .order("changed_at", desc=True)
            .execute()
            .data
        )

    @staticmethod
    async def create_opportunity(payload, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump())
        data["tenant_id"] = str(tenant_id)
        data["created_by"] = str(created_by)
        return client.table(OPP_TABLE).insert(data).execute().data[0]

    @staticmethod
    async def update_opportunity(opp_id: UUID, payload, tenant_id: UUID, *, by_agent: bool = False) -> dict:
        client = get_supabase_client()
        data = _norm(payload.model_dump(exclude_unset=True))
        is_won = data.get("status") == "WON"
        if data.get("status") in ("WON", "LOST") and "closed_at" not in data:
            data["closed_at"] = datetime.now(UTC).isoformat()

        # A stage change is a state machine move, not a field edit. Read the
        # current row first so the transition can be checked against where the
        # deal actually is rather than where the caller assumes it is.
        if "pipeline_stage" in data:
            current = (
                client.table(OPP_TABLE)
                .select("id,pipeline_id,pipeline_stage")
                .eq("id", str(opp_id))
                .eq("tenant_id", str(tenant_id))
                .single()
                .execute()
                .data
            )
            if current:
                assert_allowed(tenant_id, current, data["pipeline_stage"], by_agent=by_agent)
                if data["pipeline_stage"] in AGREEMENT_STAGES and "agreed_at" not in data:
                    data["agreed_at"] = datetime.now(UTC).isoformat()

        row = (
            client.table(OPP_TABLE).update(data).eq("id", str(opp_id)).eq("tenant_id", str(tenant_id)).execute().data[0]
        )
        if is_won:
            OpportunityService._spawn_commission_receivable(client, row, tenant_id)
        if data.get("pipeline_stage") in AGREEMENT_STAGES:
            OpportunityService._instantiate_checklist(client, row, tenant_id)
        return row

    @staticmethod
    def _instantiate_checklist(client, opp: dict, tenant_id: UUID) -> None:
        """On agreement: turn the tenant's template into this deal's file.

        Past the handshake the deal stops being a pipeline. What is uncertain is
        no longer WHETHER but WHEN, and what blocks it is the bank, the notaría
        and the conservador — none of which move because somebody followed up.

        Idempotent through the UNIQUE on `opportunity_id`: re-entering the stage
        must not wipe the work already done on the list.
        """
        existing = (
            client.table("opportunity_checklists")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .eq("opportunity_id", str(opp["id"]))
            .limit(1)
            .execute()
            .data
        )
        if existing:
            return

        templates = (
            client.table("checklist_templates")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .order("is_default", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not templates:
            return
        template_id = templates[0]["id"]

        checklist = (
            client.table("opportunity_checklists")
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "opportunity_id": str(opp["id"]),
                    "template_id": template_id,
                }
            )
            .execute()
            .data[0]
        )
        items = (
            client.table("checklist_template_items")
            .select("position,title,description,blocking,owner_role,due_offset_days")
            .eq("tenant_id", str(tenant_id))
            .eq("template_id", template_id)
            .order("position")
            .execute()
            .data
            or []
        )
        if not items:
            return
        now = datetime.now(UTC)
        client.table("opportunity_checklist_items").insert(
            [
                {
                    "tenant_id": str(tenant_id),
                    "checklist_id": checklist["id"],
                    "position": item["position"],
                    "title": item["title"],
                    "description": item.get("description"),
                    "blocking": item.get("blocking", False),
                    "due_at": (now + timedelta(days=item["due_offset_days"])).isoformat()
                    if item.get("due_offset_days") is not None
                    else None,
                }
                for item in items
            ]
        ).execute()

    @staticmethod
    def _spawn_commission_receivable(client, opp: dict, tenant_id: UUID) -> None:
        """On WIN: create a PENDING 'por cobrar' commission transaction.

        Idempotent-ish: skipped if a commission transaction already references
        this opportunity (via metadata.opportunity_id).
        """
        from datetime import timedelta

        from app.features.finance.calc import DEFAULT_CURRENCY, commission

        value = opp.get("expected_value_cents")
        if not value:
            return
        existing = (
            client.table("transactions")
            .select("id")
            .eq("tenant_id", str(tenant_id))
            .contains("metadata", {"opportunity_id": str(opp["id"])})
            .limit(1)
            .execute()
            .data
        )
        if existing:
            return

        rate = opp.get("commission_rate_pct")
        if rate is None:
            tenant = client.table("tenants").select("settings").eq("id", str(tenant_id)).single().execute().data or {}
            rate = ((tenant.get("settings") or {}).get("finance") or {}).get("commission_rate_pct", 2.0)
        calc = commission(int(value), float(rate))
        due = (datetime.now(UTC) + timedelta(days=30)).isoformat()
        client.table("transactions").insert(
            {
                "tenant_id": str(tenant_id),
                "direction": "IN",
                "category": "COMMISSION",
                "amount_cents": calc["gross_cents"],
                # The deal's own currency: defaulting to CLP would book a UF
                # receivable as pesos, off by ~40.000x.
                "currency": opp.get("currency") or DEFAULT_CURRENCY,
                "status": "PENDING",
                "occurred_at": datetime.now(UTC).isoformat(),
                "due_at": due,
                "description": "Comisión por oportunidad ganada",
                "payer_person_id": opp.get("person_id"),
                "related_property_id": opp.get("property_id"),
                "source": "system",
                "metadata": {"opportunity_id": str(opp["id"])},
            }
        ).execute()

    @staticmethod
    async def delete_opportunity(opp_id: UUID, tenant_id: UUID) -> None:
        client = get_supabase_client()
        client.table(OPP_TABLE).update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", str(opp_id)).eq(
            "tenant_id", str(tenant_id)
        ).execute()
