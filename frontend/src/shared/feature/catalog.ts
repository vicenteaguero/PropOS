/**
 * Mirror of `backend/app/core/features.py`.
 *
 * The backend owns the catalog; this file exists so a component can name a key
 * without a string literal nobody can grep. `catalog.test.ts` reads the Python
 * file and fails when the two lists drift -- a key that exists on only one side
 * is a switch that silently does nothing.
 */

export const FEATURE_KEYS = [
  "agent",
  "propo_voz",
  "pendientes",
  "crm",
  "conversaciones",
  "inbox",
  "email",
  "productividad",
  "documents",
  "propiedades",
  "portales",
  "finanzas",
  "analytics",
  "datos",
  "phones",
  "workflows",
  "uso",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * `on` normal · `wip` usable but labelled · `locked` visible and inert ·
 * `hidden` absent. The API refuses `locked` and `hidden` with 423, so none of
 * this is a cosmetic filter.
 */
export type FeatureState = "on" | "wip" | "locked" | "hidden";

export interface FeatureEntry {
  state: FeatureState;
  note: string | null;
}

export type FeatureMap = Partial<Record<string, FeatureEntry>>;

/** Missing key = `on`: a feature nobody configured behaves as it always did. */
export const DEFAULT_ENTRY: FeatureEntry = { state: "on", note: null };

export function entryFor(features: FeatureMap, key?: string): FeatureEntry {
  if (!key) return DEFAULT_ENTRY;
  return features[key] ?? DEFAULT_ENTRY;
}

/** In the nav, on a tab, as a route: is there anything to show at all? */
export function isVisible(features: FeatureMap, key?: string): boolean {
  return entryFor(features, key).state !== "hidden";
}

/** Visible but usable? `locked` is drawn, and does nothing. */
export function isEnabled(features: FeatureMap, key?: string): boolean {
  const { state } = entryFor(features, key);
  return state === "on" || state === "wip";
}
