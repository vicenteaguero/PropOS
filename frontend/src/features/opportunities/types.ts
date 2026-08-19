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
