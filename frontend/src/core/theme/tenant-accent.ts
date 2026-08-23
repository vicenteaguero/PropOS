/**
 * Tenant-driven brand accent. Two modes:
 *  - explicit `color` (tenant settings.brand_color hex) → set --accent-brand
 *    directly + a luminance-picked foreground.
 *  - otherwise a stable `hue` derived from the tenant id/slug → set --accent-hue
 *    and let index.css pick lightness per theme (darker in light, lighter in
 *    dark). This is the v1 default until a brokerage sets its exact color.
 *
 * The tenant accent always applies (injected inline on <html>), so switching
 * workspace recolors the brand immediately regardless of any dev palette.
 */

import { paletteOwnsAccent } from "./palette";

/** Curated, harmonious hues (avoids muddy/ambiguous ones). Index picked by hash. */
const HUES = [347, 152, 220, 270, 25, 190, 330, 45, 95, 300];
const DEFAULT_HUE = 347; // ≈ rosa-antiguo
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

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

/**
 * The one true swatch for a workspace, used by every switcher.
 *
 * Each surface used to build its own `hsl(...)` from `hueForTenant` with its own
 * lightness and saturation — 42%/55% on home, 42%/60% in the "Más" sheet,
 * 55%/55% in the desktop header — while the pill's dot used `--accent-brand`
 * (45% light / 70% dark). So one workspace showed up in four different colours,
 * and a tenant with an explicit brand_color got the hashed hue anyway.
 */
export function tenantSwatch(seed: string | null | undefined, color?: string | null): string {
  if (color && HEX_RE.test(color)) return color.startsWith("#") ? color : `#${color}`;
  return `hsl(${hueForTenant(seed)} 42% 52%)`;
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

interface AccentInput {
  seed?: string | null;
  color?: string | null;
  /**
   * How much of the brand bleeds into every surface, 0-12%.
   *
   * index.css writes EVERY surface token as
   * `color-mix(in srgb, var(--accent-brand) var(--tint), <neutral>)`, so this
   * one number tints backgrounds, cards, borders, muted text and the sidebar at
   * once. It shipped hard-coded at 0%, which is why the palette machinery was
   * there but the app looked uniformly grey whatever the brand colour was.
   */
  tint?: number | null;
}

/** Clamp: past ~12% the neutrals stop reading as neutral and text contrast goes. */
const MAX_TINT = 12;

/**
 * Inject the tenant accent + surface tint inline on <html>.
 *
 * No-op while the user runs a palette of their own: a palette writes the same
 * three tokens, and the person's pick outranks the workspace's. Guarding here
 * rather than at each call site means boot order stops mattering — the accent
 * cannot land on top of the palette a moment after it was applied.
 */
export function applyTenantAccent({ seed, color, tint }: AccentInput): void {
  if (typeof document === "undefined") return;
  if (paletteOwnsAccent()) return;
  const style = document.documentElement.style;

  if (typeof tint === "number" && Number.isFinite(tint)) {
    style.setProperty("--tint", `${Math.min(MAX_TINT, Math.max(0, tint))}%`);
  } else {
    style.removeProperty("--tint");
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

/**
 * The last resolved accent, replayed before the first paint.
 *
 * `tenantId` arrives with the auth session but `brand_color`, `brand_tint` and
 * the curated `[data-tenant]` palette all come from `/v1/tenants/me`, a network
 * round trip later. So a signed-in user watched the app paint in the default
 * palette and then recolour itself once the query landed — every launch, every
 * reload. Caching the resolved values and applying them synchronously at boot
 * removes the flash; the query still runs and still wins, it just usually
 * agrees with what is already on screen.
 */
const CACHE_KEY = "propos:tenant-accent";
const ACTIVE_TENANT_KEY = "propos.active_tenant_id";

interface CachedAccent extends AccentInput {
  slug?: string | null;
}

export function cacheTenantAccent(accent: CachedAccent): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(accent));
  } catch {
    // Private mode / quota. The accent still applies, it just flashes next boot.
  }
}

/** The cached accent, but only if it belongs to `seed`. Null otherwise. */
export function readCachedAccent(seed: string | null): CachedAccent | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as CachedAccent) : null;
    if (!cached?.seed) return null;
    // Switching workspace writes the new id immediately; the accent cache only
    // catches up once the new tenant's branding resolves. Replaying a mismatched
    // accent would paint the previous brokerage's colours.
    return cached.seed === seed ? cached : null;
  } catch {
    return null;
  }
}

/** Apply the cached accent, if it belongs to the workspace we are about to open. */
export function bootstrapTenantAccent(): void {
  if (typeof document === "undefined") return;
  if (paletteOwnsAccent()) return;
  let active: string | null = null;
  try {
    active = localStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    return;
  }
  const cached = readCachedAccent(active);
  if (!cached) return;
  applyTenantAccent(cached);
  if (cached.slug) document.documentElement.dataset.tenant = cached.slug;
}

/** Remove all inline accent overrides → falls back to the index.css default. */
export function clearTenantAccent(): void {
  if (typeof document === "undefined") return;
  if (paletteOwnsAccent()) return;
  const style = document.documentElement.style;
  style.removeProperty("--accent-hue");
  style.removeProperty("--accent-brand");
  style.removeProperty("--accent-brand-foreground");
}
