/**
 * Tags: a name, a colour, and the number of rows wearing it.
 *
 * The count is the only thing that makes this catalog reviewable. A list of
 * forty labels sorted alphabetically says nothing about which ones the
 * brokerage actually uses, and an unused tag is not a neutral leftover — it is
 * a choice offered in every picker that nobody ever picks.
 */

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  usage_count: number;
}

/** The swatches the seeded tags already use, so the picker matches the data. */
export const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The palette, plus the tag's own colour when it is not in it.
 *
 * The seeded tags use colours outside `TAG_COLORS` (`#94a3b8`, for one). A
 * fixed swatch row would show none of them as selected, so an editor opened on
 * such a tag looks like it has no colour at all — and the first click would
 * quietly change one.
 */
export function swatchesFor(color: string | null): string[] {
  const current = (color ?? "").toLowerCase();
  const palette = TAG_COLORS.map((c) => c.toLowerCase());
  if (!current || !HEX.test(current) || palette.includes(current)) return [...palette];
  return [...palette, current];
}

export function isValidColor(color: string | null): boolean {
  return color === null || color === "" || HEX.test(color);
}

/** Most used first — the ones carrying the segmentation lead. */
export function sortTags(tags: Tag[]): Tag[] {
  return [...tags].sort(
    (a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name, "es"),
  );
}

export function unusedTags(tags: Tag[]): Tag[] {
  return tags.filter((tag) => tag.usage_count === 0);
}

export function tagIssue(
  name: string,
  color: string | null,
  existing: Tag[],
  id?: string,
): string | null {
  const clean = name.trim();
  if (!clean) return "Ponle un nombre a la etiqueta.";
  if (!isValidColor(color)) return "El color tiene que ser un hex de seis dígitos, como #3b82f6.";
  // The database has UNIQUE (tenant_id, name) and would answer with a 409; the
  // name is right there on screen, so say it before the round trip.
  const clash = existing.some(
    (tag) => tag.id !== id && tag.name.trim().toLowerCase() === clean.toLowerCase(),
  );
  if (clash) return "Ya existe una etiqueta con ese nombre.";
  return null;
}
