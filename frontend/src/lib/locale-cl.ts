/** Chile-specific helpers used by Anita transcript normalization. */

const RUT_RE = /^\d{1,8}-?[0-9kK]$/;

export function formatRut(raw: string): string {
  const cleaned = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length < 2) return raw;
  const dv = cleaned.slice(-1);
  const body = cleaned.slice(0, -1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}

export function isValidRut(raw: string): boolean {
  return RUT_RE.test(raw.replace(/\./g, ""));
}

export function formatCLP(amount: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** "50 lucas" → 50000, "2 palos" → 2_000_000 */
export function parseChileanAmount(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(lucas?|palos?|pesos?|cucas?|kpe?)?/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  const unit = m[2] || "";
  if (unit.startsWith("luca")) return Math.round(value * 1_000);
  if (unit.startsWith("palo")) return Math.round(value * 1_000_000);
  return Math.round(value);
}

/** "el martes pasado", "hoy", "ayer", "mañana" → ISO date */
export function parseRelativeDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase().trim();
  const d = new Date(now);
  if (t === "hoy") return d.toISOString().slice(0, 10);
  if (t === "ayer") {
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (t === "mañana") {
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  const weekdays = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const m = t.match(/^el\s+(\w+)\s+pasad[oa]$/);
  if (m) {
    const idx = weekdays.indexOf(m[1]);
    if (idx >= 0) {
      const todayIdx = d.getDay();
      const diff = ((todayIdx - idx + 7) % 7) || 7;
      d.setDate(d.getDate() - diff);
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}
