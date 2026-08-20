/**
 * "Juan Ignacio Pérez Salas" -> "Juan Pérez". The sheet header is 200px wide on
 * a phone, so a full Chilean legal name (two given names, two surnames) either
 * truncated mid-word or pushed the controls beside it off the row.
 */
export function shortName(full: string | null | undefined): string {
  // Tolerant of a missing name: this renders inside the bottom nav, which wraps
  // every page of the phone shell, so throwing here white-screened the entire
  // PWA rather than losing one label. A profile row can legitimately arrive
  // without `full_name` — an invited user who has not completed setup.
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Mi cuenta";
  if (parts.length <= 2) return parts.join(" ");
  // Two given names is the common case, so the surname is the third token.
  return `${parts[0]} ${parts[parts.length >= 4 ? 2 : 1]}`;
}
