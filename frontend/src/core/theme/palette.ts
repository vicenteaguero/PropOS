/**
 * Theme palette management. Always dark mode — only the accent/surface
 * variables change between palettes (see index.css [data-palette="..."]).
 *
 * Persisted client-side in localStorage; restored on app boot.
 */

export const PALETTES = ["default", "anthropic", "slate"] as const;
export type Palette = (typeof PALETTES)[number];

export const PALETTE_LABELS: Record<Palette, string> = {
  default: "Por defecto",
  anthropic: "Anthropic",
  slate: "Slate",
};

const STORAGE_KEY = "propos:palette";
const DEFAULT_PALETTE: Palette = "default";

function isPalette(value: string | null): value is Palette {
  return value !== null && (PALETTES as readonly string[]).includes(value);
}

export function getStoredPalette(): Palette {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isPalette(raw) ? raw : DEFAULT_PALETTE;
}

export function applyPalette(palette: Palette): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = palette;
}

export function setPalette(palette: Palette): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, palette);
  applyPalette(palette);
}

/** Restore persisted palette on app boot. Call once before render. */
export function bootstrapPalette(): void {
  applyPalette(getStoredPalette());
}
