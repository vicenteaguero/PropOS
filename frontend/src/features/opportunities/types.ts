import { categoryVars, type CategoryColor } from "@shared/ui/category-palette";

export const PIPELINE_STAGES = [
  "LEAD",
  "QUALIFIED",
  "VISIT",
  "OFFER",
  "RESERVATION",
  "CLOSED",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Identical to the shared registry; re-exported under the local name callers use.
export { PIPELINE_STAGE_LABELS as STAGE_LABELS } from "@shared/lib/labels";

/**
 * Accent per stage, as a CSS var reference so the value follows the theme
 * instead of being a hex in a className.
 *
 * This existed twice and disagreed: the kanban painted LEAD grey and CLOSED
 * green, the CRM's lane view painted LEAD `--chart-1` and CLOSED `--chart-3`.
 * Two colours for one stage on two screens of the same section is a reading
 * error, not a styling nit — the dot is the only thing distinguishing lanes at
 * a glance. And so is ONE colour for two stages, which is what this was.
 */
// Every member comes from the fixed categorical palette. It used to mix three
// sources and two of the six collided outright: `--primary` IS
// `var(--accent-brand)` (index.css:310 light, :395 dark), so VISIT and
// RESERVATION painted the identical dot on every tenant in both themes — in a
// control whose docblock says the dot is the only thing distinguishing lanes.
// `--chart-2` was the third: #f0d8da on a near-white ground in light, and pure
// #ffffff in dark.
//
// The ramp stays monotonic — cold at the top of the funnel, warm in the
// middle, green at the close — it just no longer borrows the workspace hue to
// do it. See `shared/ui/category-palette.ts`.
const STAGE_COLOR: Record<string, CategoryColor> = {
  LEAD: "slate",
  QUALIFIED: "sky",
  VISIT: "indigo",
  OFFER: "amber",
  RESERVATION: "orange",
  CLOSED: "lime",
};

export const STAGE_DOT: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_COLOR).map(([stage, color]) => [stage, categoryVars(color).ink]),
);

/** Stage accent, falling back to the neutral dot for anything unmapped. */
export function stageDot(stage: string): string {
  return STAGE_DOT[stage] ?? "var(--muted-foreground)";
}

export type OpportunityStatus = "OPEN" | "WON" | "LOST";

export interface Opportunity {
  id: string;
  tenant_id: string;
  pipeline_id: string | null;
  person_id: string | null;
  property_id: string | null;
  project_id: string | null;
  pipeline_stage: string;
  status: OpportunityStatus;
  expected_close_at: string | null;
  expected_value_cents: number | null;
  currency: string;
  probability: number | null;
  lost_reason: string | null;
  notes: string | null;
  /** Participants and properties BEYOND the principal person_id/property_id. */
  extra_participants: number;
  extra_properties: number;
  /**
   * Every comuna this deal touches — the principal property's and each one in
   * `opportunity_properties`. Resolved server-side; the board used to build a
   * map from a 100-row property fetch, which is why the comuna control found
   * nothing on a tenant with 40 properties and 500 deals.
   */
  comunas?: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface OpportunityInput {
  person_id?: string | null;
  property_id?: string | null;
  pipeline_stage?: string;
  status?: OpportunityStatus;
  expected_value_cents?: number | null;
  expected_close_at?: string | null;
  notes?: string | null;
  lost_reason?: string | null;
}
