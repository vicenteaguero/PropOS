import { apiRequest } from "@shared/api/http";
import type { Opportunity } from "@features/opportunities/types";

/** A person in the deal, with their role in it. */
export interface DealParticipant {
  id: string;
  contact_id: string;
  role: string;
  full_name: string;
}

/** A property the deal touches — they saw three and offered on one. */
export interface DealProperty {
  id: string;
  property_id: string;
  role: "interest" | "offered" | "closed" | "discarded";
  property: {
    id: string;
    title: string;
    status: string;
    list_price_cents: number | null;
    currency: string | null;
  } | null;
}

export interface DealStageChange {
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_at: string;
  changed_by: string | null;
}

/** One line of the file a deal becomes after the handshake. */
export interface ChecklistItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "blocked" | "na";
  blocking: boolean;
  due_at: string | null;
  document_id: string | null;
  completed_at: string | null;
}

export interface AllowedTransition {
  to_stage: string;
  /** Marking a deal won or lost is a commercial judgement; a person makes it. */
  requires_human: boolean;
}

export interface DealDetail {
  opportunity: Opportunity;
  participants: DealParticipant[];
  properties: DealProperty[];
  history: DealStageChange[];
  checklist: ChecklistItem[];
  allowed_transitions: AllowedTransition[];
}

export const dealsApi = {
  detail: (id: string) => apiRequest<DealDetail>(`/v1/opportunities/${id}/detail`),
  setStage: (id: string, stage: string) =>
    apiRequest<Opportunity>(`/v1/opportunities/${id}`, {
      method: "PATCH",
      body: { pipeline_stage: stage },
    }),
};

// --------------------------------------------------------------------------
// Overview — everything hanging off a deal, for the reusable summary.
// --------------------------------------------------------------------------

export interface DealOverviewParticipant {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
}

export interface DealOverviewProperty {
  id: string;
  title: string | null;
  address: string | null;
  status: string | null;
  list_price_cents: number | null;
  currency: string | null;
  role: string | null;
}

export interface DealOverviewEvent {
  id: string;
  title: string | null;
  kind: string | null;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean | null;
  location: string | null;
  property_id: string | null;
  status: string | null;
}

export interface DealOverviewTask {
  id: string;
  title: string | null;
  due_at: string | null;
  priority: number | null;
  status: string | null;
}

export interface DealOverviewCounts {
  participants: number;
  properties: number;
  open_tasks: number;
  notes: number;
  documents: number;
  transactions: number;
}

export interface DealOverview {
  opportunity: Opportunity;
  participants: DealOverviewParticipant[];
  properties: DealOverviewProperty[];
  next_event: DealOverviewEvent | null;
  open_tasks: DealOverviewTask[];
  transactions: {
    id: string;
    description: string | null;
    amount_cents: number | null;
    currency: string | null;
    status: string | null;
    due_at: string | null;
    category: string | null;
  }[];
  pending_amount_cents: number;
  counts: DealOverviewCounts;
}

export const dealOverviewApi = {
  get: (id: string) => apiRequest<DealOverview>(`/v1/opportunities/${id}/overview`),
};
