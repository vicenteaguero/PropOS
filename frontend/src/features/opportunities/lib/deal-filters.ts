import type { Opportunity } from "../types";

export type DealOrder = "stage" | "value" | "age";

export const DEAL_ORDERS: { value: DealOrder; label: string; sub: string }[] = [
  { value: "stage", label: "Por etapa", sub: "El orden del pipeline" },
  { value: "value", label: "Monto", sub: "Los más grandes primero" },
  { value: "age", label: "Antigüedad", sub: "Los que llevan más tiempo sin moverse" },
];

/**
 * Narrow the board.
 *
 * Pulled out of the page so the comuna filter is testable. It was untestable
 * and, as it turns out, broken: it read a map built from a 100-row property
 * fetch against 500 deals, so it matched almost nothing and every deal fell
 * into "Sin comuna". `comunas` now arrives on the row, resolved server-side
 * from the principal property AND `opportunity_properties`.
 */
export function filterDeals(
  deals: Opportunity[],
  {
    comuna,
    query,
    labelFor,
  }: { comuna?: string | null; query?: string; labelFor?: (o: Opportunity) => string },
): Opportunity[] {
  let rows = deals;
  if (comuna) rows = rows.filter((o) => (o.comunas ?? []).includes(comuna));
  const q = (query ?? "").trim().toLowerCase();
  if (q && labelFor) rows = rows.filter((o) => labelFor(o).toLowerCase().includes(q));
  return rows;
}

export function orderDeals(deals: Opportunity[], order: DealOrder): Opportunity[] {
  if (order === "value") {
    return [...deals].sort((a, b) => (b.expected_value_cents ?? 0) - (a.expected_value_cents ?? 0));
  }
  if (order === "age") {
    // Oldest first: the point of ordering by age is to surface what has been
    // sitting untouched, not to re-show what you created this morning.
    return [...deals].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return deals;
}

/** Every comuna present in the current book, for the filter's options. */
export function comunasIn(deals: Opportunity[]): string[] {
  const seen = new Set<string>();
  for (const o of deals) for (const c of o.comunas ?? []) seen.add(c);
  return [...seen].sort((a, b) => a.localeCompare(b, "es"));
}
