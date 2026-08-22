import type { PendingProposal } from "@features/agent/types";

/**
 * Where the record an accepted proposal created actually lives.
 *
 * The map is a frontend fact — routes are declared in `app/router.tsx` and the
 * backend has no business knowing `/admin/personas/:id`. The accept path writes
 * both `target_table` and `created_row_id`, so this is a lookup, not a guess.
 */
const ROUTE_BY_TABLE: Record<string, string> = {
  contacts: "personas",
  properties: "propiedades",
  opportunities: "negocios",
  documents: "documents",
  // `_accept_attach_photos_to_property` returns ("media_assets", PROPERTY id).
  // The table name lies about what the id is, and a naive /media_assets/:id
  // link would 404 — locked by a backend test so a future refactor cannot
  // change the contract silently.
  media_assets: "propiedades",
};

export function recordPath(proposal: PendingProposal, role: string): string | null {
  const { target_table: table, created_row_id: id } = proposal;
  if (!table || !id) return null;
  const segment = ROUTE_BY_TABLE[table];
  if (segment) return `/${role}/${segment}/${id}`;
  // Tasks, events, interactions, transactions, notes, campaigns, organizations:
  // no detail page of their own, but the universal timeline route opens any row.
  return `/${role}/timeline/${table}/${id}`;
}
