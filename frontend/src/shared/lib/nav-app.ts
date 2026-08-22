/**
 * Which navigation app this broker uses, and how to hand it an address.
 *
 * The two href templates lived inline on the property detail page — the only
 * place in the product that offered directions at all — and drifted while they
 * were there: the Waze anchor had no `target`/`rel` and the Maps one did.
 *
 * The preference is per BROKER, not per workspace: it is a property of the
 * phone in their hand, and two people in the same office will not agree. Same
 * localStorage idiom as the theme (`core/theme/theme.ts`).
 */
export type NavApp = "waze" | "maps";

const STORAGE_KEY = "propos:nav-app";
const DEFAULT_APP: NavApp = "maps";

const isNavApp = (value: unknown): value is NavApp => value === "waze" || value === "maps";

export function getNavApp(): NavApp {
  if (typeof window === "undefined") return DEFAULT_APP;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isNavApp(raw) ? raw : DEFAULT_APP;
  } catch {
    return DEFAULT_APP;
  }
}

export function setNavApp(app: NavApp): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, app);
  } catch {
    // Private mode. The default still works; only the choice is lost.
  }
}

/** A link that opens `address` in `app`, or null when there is no address. */
export function navHref(address: string | null | undefined, app: NavApp): string | null {
  const query = address?.trim();
  if (!query) return null;
  return app === "waze"
    ? `waze://?q=${encodeURIComponent(query)}&navigate=yes`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const NAV_APP_LABEL: Record<NavApp, string> = { waze: "Waze", maps: "Google Maps" };
