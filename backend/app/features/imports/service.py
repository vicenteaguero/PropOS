from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from uuid import UUID

from app.core.supabase.client import get_supabase_client
from app.features.contacts.schemas import ContactCreate
from app.features.imports.mappings import coerce_row, map_header
from app.features.transactions.schemas import TransactionCreate

MAX_ROWS = 5000
_VALIDATORS = {"contacts": ContactCreate, "transactions": TransactionCreate}
_TABLE = {"contacts": "contacts", "transactions": "transactions"}


class ImportService:
    @staticmethod
    async def preview(entity: str, filename: str, content: bytes, tenant_id: UUID, created_by: UUID) -> dict:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        validator = _VALIDATORS[entity]

        staged: list[dict] = []
        errors: list[dict] = []
        valid = 0
        for i, raw in enumerate(reader):
            if i >= MAX_ROWS:
                errors.append({"row": i, "field": "_", "message": f"fila omitida (límite {MAX_ROWS})"})
                break
            mapped = {}
            for header, value in raw.items():
                canon = map_header(entity, header or "")
                if canon:
                    mapped[canon] = value
            coerced = coerce_row(entity, mapped)
            try:
                validator(**coerced)
                valid += 1
                staged.append({"_valid": True, **coerced})
            except Exception as exc:  # noqa: BLE001
                errors.append({"row": i, "field": "_", "message": str(exc)[:200]})
                staged.append({"_valid": False, **coerced})

        client = get_supabase_client()
        job = (
            client.table("import_jobs")
            .insert(
                {
                    "tenant_id": str(tenant_id),
                    "entity": entity,
                    "filename": filename,
                    "rows": staged,
                    "total_rows": len(staged),
                    "valid_rows": valid,
                    "errors": errors,
                    "created_by": str(created_by),
                }
            )
            .execute()
            .data[0]
        )
        return {
            "import_id": job["id"],
            "entity": entity,
            "total_rows": len(staged),
            "valid_rows": valid,
            "invalid_rows": len(staged) - valid,
            "errors": errors[:50],
            "sample_rows": staged[:10],
        }

    @staticmethod
    async def commit(import_id: UUID, tenant_id: UUID, created_by: UUID) -> dict:
        client = get_supabase_client()
        job = (
            client.table("import_jobs")
            .select("*")
            .eq("id", str(import_id))
            .eq("tenant_id", str(tenant_id))
            .single()
            .execute()
            .data
        )
        if not job or job["status"] != "PREVIEW":
            raise ValueError("import not in PREVIEW state")

        entity = job["entity"]
        table = _TABLE[entity]
        valid_rows = [
            {k: v for k, v in r.items() if k != "_valid"} for r in (job.get("rows") or []) if r.get("_valid")
        ]
        for r in valid_rows:
            r["tenant_id"] = str(tenant_id)
            r["created_by"] = str(created_by)
            r["source"] = "import"

        inserted = 0
        if valid_rows:
            inserted = len(client.table(table).insert(valid_rows).execute().data or [])

        client.table("import_jobs").update(
            {"status": "COMMITTED", "inserted_rows": inserted, "committed_at": datetime.now(UTC).isoformat()}
        ).eq("id", str(import_id)).execute()
        return {"import_id": str(import_id), "inserted_rows": inserted}

    @staticmethod
    async def list_jobs(tenant_id: UUID) -> list[dict]:
        client = get_supabase_client()
        return (
            client.table("import_jobs")
            .select("id, entity, filename, status, total_rows, valid_rows, inserted_rows, created_at")
            .eq("tenant_id", str(tenant_id))
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
            .data
        )
