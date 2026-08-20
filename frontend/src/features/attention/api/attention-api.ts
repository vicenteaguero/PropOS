import { apiRequest } from "@shared/api/http";

/** Mirrors `AttentionKind` on the API. */
export type AttentionKind = "unanswered" | "lead" | "visit" | "task" | "stalled";

/** Mirrors `Urgency` on the API. */
export type Urgency = "now" | "today" | "soon";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  urgency: Urgency;
  title: string;
  subtitle: string | null;
  reason: string;
  at: string | null;
  /** When this stops being fixable cheaply. Null when nothing forces it. */
  deadline: string | null;
  contact_id: string | null;
  property_id: string | null;
  conversation_id: string | null;
  thread_id: string | null;
  event_id: string | null;
  task_id: string | null;
  opportunity_id: string | null;
}

export interface AttentionFeed {
  items: AttentionItem[];
  /** Per-kind totals BEFORE the limit, so a filter can show a real count. */
  counts: Record<AttentionKind, number>;
  total: number;
}

export const attentionKeys = {
  feed: (limit: number) => ["attention", limit] as const,
};

export function fetchAttention(limit: number) {
  return apiRequest<AttentionFeed>(`/v1/attention?limit=${limit}`);
}
