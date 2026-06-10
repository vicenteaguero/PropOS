/** Format integer cents (CLP has no minor unit in practice) as Chilean pesos. */
export function formatClp(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
