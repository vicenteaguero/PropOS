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

/**
 * `$185M` · `$4,2M` · `$850K` — a price that fits in a list column.
 *
 * A Chilean property is priced in the hundreds of millions, so
 * `formatClpAmount` produces "$185.000.000": fourteen characters, wider than
 * the title above it, and read digit by digit to work out the magnitude. The
 * magnitude is the whole question when scanning forty rows.
 *
 * The full figure stays on the detail page, where the exact number matters.
 */
export function abbreviateClp(cents: number | null | undefined, fallback = "—"): string {
  if (cents == null) return fallback;
  const amount = cents / 100;
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = amount / 1_000_000;
    // One decimal below 100M, none above: "$185,4M" is noise, "$4,2M" is not.
    const digits = abs < 100_000_000 ? 1 : 0;
    return `$${millions.toLocaleString("es-CL", { maximumFractionDigits: digits })}M`;
  }
  if (abs >= 1_000) {
    return `$${Math.round(amount / 1_000).toLocaleString("es-CL")}K`;
  }
  return formatClpAmount(amount);
}

/** `UF 4.200` — UF is already a small number, so it only needs its unit. */
export function formatUf(value: number | null | undefined, fallback = "—"): string {
  if (value == null) return fallback;
  return `UF ${value.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}
