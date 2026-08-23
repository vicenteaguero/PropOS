/**
 * Names, shortened for a row rather than for a legal document.
 *
 * Every list in the app is a fixed-width column beside other fixed-width
 * columns, and Chilean names and property titles are both long by convention —
 * two given names plus two surnames, "Departamento 3D/3B en venta en Macul".
 * Truncating with an ellipsis loses the identifying half; these keep it.
 */

/**
 * "Juan Ignacio Pérez Salas" → "Juan Pérez". First given name, first surname.
 *
 * Tolerant of a missing name: this renders inside the bottom nav, which wraps
 * every page of the phone shell, so throwing here white-screened the entire PWA
 * rather than losing one label. A profile row can legitimately arrive without
 * `full_name` — an invited user who has not completed setup.
 */
export function shortName(full: string | null | undefined, fallback = ""): string {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length <= 2) return parts.join(" ");
  // Two given names is the common case, so the surname is the third token.
  return `${parts[0]} ${parts[parts.length >= 4 ? 2 : 1]}`;
}

// "Departamento 3D/3B en venta en Macul" — the shape `seed_demo` writes and the
// one brokers type by hand, because the portals ask for it in that order.
const TITLE_RE = /^(.*?)\s*(\d+D\/\d+B)?\s*en\s+(?:venta|arriendo)\s+en\s+(.+)$/i;

/**
 * "Departamento 3D/3B en venta en Macul" → "3D/3B · Macul".
 *
 * The two facts a broker scans a property list for are size and comuna. The
 * kind is already carried by the card's icon and the operation by the filter
 * that produced the list, so both are noise inside the row that repeats them
 * forty times.
 */
export function shortPropertyTitle(title: string | null | undefined): string {
  const raw = (title ?? "").trim();
  if (!raw) return "";
  const m = TITLE_RE.exec(raw);
  if (!m) return raw;
  const [, kind, size, comuna] = m;
  // No bedroom count (a commercial unit, a plot): the kind is all that is left
  // to say, so keep it rather than returning a bare comuna.
  const left = size || kind.trim();
  return left ? `${left} · ${comuna.trim()}` : comuna.trim();
}
