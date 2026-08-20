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
 * Accent per stage, as a CSS var reference so the value follows the theme and
 * the tenant hue instead of being a hex in a className.
 *
 * This existed twice and disagreed: the kanban painted LEAD grey and CLOSED
 * green, the CRM's lane view painted LEAD `--chart-1` and CLOSED `--chart-3`.
 * Two colours for one stage on two screens of the same section is a reading
 * error, not a styling nit — the dot is the only thing distinguishing lanes at
 * a glance. The ramp below is deliberately monotonic: cold at the top of the
 * funnel, warm in the middle, success at the close.
 */
export const STAGE_DOT: Record<string, string> = {
  LEAD: "var(--muted-foreground)",
  QUALIFIED: "var(--chart-2)",
  VISIT: "var(--primary)",
  OFFER: "var(--warning)",
  RESERVATION: "var(--accent-brand)",
  CLOSED: "var(--success)",
};

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
