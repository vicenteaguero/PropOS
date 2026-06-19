from __future__ import annotations

from uuid import UUID

from app.core.supabase.client import get_supabase_client


class FinanceService:
    @staticmethod
    async def summary(tenant_id: UUID, month: str | None = None) -> dict:
        """Aggregate IN/OUT totals + por-cobrar / por-pagar for the tenant.

        ``month`` is an optional 'YYYY-MM' filter on occurred_at.
        """
        client = get_supabase_client()
        builder = (
            client.table("transactions")
            .select("direction, status, amount_cents, currency")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
        )
        if month:
            # occurred_at is timestamptz: use a half-open [first, next-month) range.
            # The old `<= {month}-31` dropped late-day 31st rows and used an
            # invalid date for 30-day/February months.
            from datetime import date

            y, m = map(int, month.split("-"))
            nxt = date(y + (m == 12), (m % 12) + 1, 1)
            builder = builder.gte("occurred_at", f"{month}-01").lt("occurred_at", nxt.isoformat())
        rows = builder.execute().data or []

        income = sum(r["amount_cents"] for r in rows if r["direction"] == "IN" and r["status"] == "COMPLETED")
        expense = sum(r["amount_cents"] for r in rows if r["direction"] == "OUT" and r["status"] == "COMPLETED")
        receivable = sum(r["amount_cents"] for r in rows if r["direction"] == "IN" and r["status"] == "PENDING")
        payable = sum(r["amount_cents"] for r in rows if r["direction"] == "OUT" and r["status"] == "PENDING")

        return {
            "month": month,
            "income_cents": income,
            "expense_cents": expense,
            "net_cents": income - expense,
            "receivable_cents": receivable,
            "payable_cents": payable,
        }
