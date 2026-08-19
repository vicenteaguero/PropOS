/**
 * Format integer cents (CLP has no minor unit in practice) as Chilean pesos.
 *
 * `fallback` covers the absent-value case: a list of properties says
 * "Precio a convenir", a totals row wants the em dash. Pass it explicitly
 * rather than post-processing the result.
 */
export function formatClp(cents: number | null | undefined, fallback = "—"): string {
  if (cents == null) return fallback;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
