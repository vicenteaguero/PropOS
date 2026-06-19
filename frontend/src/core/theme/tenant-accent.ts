/**
 * Tenant-driven brand accent. Two modes:
 *  - explicit `color` (tenant settings.brand_color hex) → set --accent-brand
 *    directly + a luminance-picked foreground.
 *  - otherwise a stable `hue` derived from the tenant id/slug → set --accent-hue
 *    and let index.css pick lightness per theme (darker in light, lighter in
 *    dark). This is the v1 default until a brokerage sets its exact color.
 *
 * Precedence: a non-default dev palette sets its own --primary and wins, so we
 * skip injection entirely when the active palette is not "default".
 */

import { getStoredPalette } from "./palette";

/** Curated, harmonious hues (avoids muddy/ambiguous ones). Index picked by hash. */
const HUES = [347, 152, 220, 270, 25, 190, 330, 45, 95, 300];
const DEFAULT_HUE = 347; // ≈ rosa-antiguo

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable hue for a tenant seed (slug preferred, id fallback). */
export function hueForTenant(seed: string | null | undefined): number {
  if (!seed) return DEFAULT_HUE;
  return HUES[hash(seed) % HUES.length] ?? DEFAULT_HUE;
}

/** Pick a readable foreground (ink or white) for a hex background. */
function readableForeground(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#FFFFFF";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1C1816" : "#FFFFFF";
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

interface AccentInput {
  seed?: string | null;
  color?: string | null;
}

/** Inject the tenant accent inline on <html>. No-op (clears) under a dev palette. */
export function applyTenantAccent({ seed, color }: AccentInput): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;

  if (getStoredPalette() !== "default") {
    clearTenantAccent();
    return;
  }

  if (color && HEX_RE.test(color)) {
    const hex = color.startsWith("#") ? color : `#${color}`;
    style.setProperty("--accent-brand", hex);
    style.setProperty("--accent-brand-foreground", readableForeground(hex));
    style.removeProperty("--accent-hue");
    return;
  }

  if (seed) {
    // Hue mode: let index.css derive the brand color per theme.
    style.removeProperty("--accent-brand");
    style.removeProperty("--accent-brand-foreground");
    style.setProperty("--accent-hue", String(hueForTenant(seed)));
    return;
  }

  clearTenantAccent();
}

/** Remove all inline accent overrides → falls back to the index.css default. */
export function clearTenantAccent(): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  style.removeProperty("--accent-hue");
  style.removeProperty("--accent-brand");
  style.removeProperty("--accent-brand-foreground");
}
