/**
 * Chilean peso formatting, once.
 *
 * There were four implementations: this one, `@/lib/locale-cl`'s `formatCLP`,
 * and private copies inside the opportunity kanban and the contact
 * opportunities list. Three of them agreed by accident; the fourth returned an
 * empty string for a zero-value deal, which read as "no data" rather than "$0".
 *
 * Two entry points, because the app genuinely has two units on the wire:
 * `formatClp` takes CENTS (every `*_cents` column) and `formatClpAmount` takes
 * WHOLE PESOS (analytics aggregates, the agent's transcript normalizer).
 */

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Format whole pesos.
 *
 * `fractionDigits` exists only for the rare rate/ratio display; the currency
 * has no minor unit in practice, so the default is 0.
 */
export function formatClpAmount(amount: number, fractionDigits = 0): string {
  if (fractionDigits === 0) return CLP.format(amount);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/**
 * Format integer cents.
 *
 * `fallback` covers the absent-value case: a list of properties says
 * "Precio a convenir", a totals row wants the em dash. Pass it explicitly
 * rather than post-processing the result. Note 0 is a VALUE, not an absence —
 * only null/undefined take the fallback.
 */
export function formatClp(cents: number | null | undefined, fallback = "—"): string {
  if (cents == null) return fallback;
  return formatClpAmount(cents / 100);
}
