/**
 * Light/dark theme management. Orthogonal to the dev palette switcher
 * (see palette.ts) and the tenant accent (see tenant-accent.ts).
 *
 * Mechanism: toggles `class="dark"` on <html>. The dark class is set
 * statically in index.html so dark (the default) never flashes; this module
 * only removes it when the user has opted into light.
 *
 * Persisted client-side in localStorage; restored on app boot.
 */

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "propos:theme";
const DEFAULT_THEME: Theme = "dark";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(raw) ? raw : DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Restore persisted theme on app boot. Call once before render. */
export function bootstrapTheme(): void {
  applyTheme(getStoredTheme());
}
