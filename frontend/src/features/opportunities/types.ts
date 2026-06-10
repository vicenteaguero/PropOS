export const PIPELINE_STAGES = [
  "LEAD",
  "QUALIFIED",
  "VISIT",
  "OFFER",
  "RESERVATION",
  "CLOSED",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUALIFIED: "Calificado",
  VISIT: "Visita",
  OFFER: "Oferta",
  RESERVATION: "Reserva",
  CLOSED: "Cerrado",
};

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
