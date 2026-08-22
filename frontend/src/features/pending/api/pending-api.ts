import { apiRequest } from "@shared/api/http";
import type { PendingProposal, ProposalRejectReason } from "@features/agent/types";

const BASE = "/v1/pending";

export interface AcceptBody {
  overrides?: Record<string, unknown>;
  disambiguation?: Record<string, string>;
  note?: string;
}

export interface RejectBody {
  /** Free-text detail. Stored in `review_note`. */
  reason?: string;
  /**
   * Taxonomy value, stored in `review_reason`. Separate from `reason` because
   * free text cannot be counted, and a rejection is the cheapest signal there
   * is about where Propo is getting things wrong.
   */
  review_reason?: ProposalRejectReason;
}

/**
 * Which slice of the pending queue to ask for. See the backend's
 * `PendingService.list_proposals`: one flat order either buries what is running
 * out or buries what just arrived, so the server serves three.
 */
export type PendingBucket = "all" | "urgent" | "recent" | "old";

export interface ListParams {
  status?: string;
  kind?: string;
  bucket?: PendingBucket;
  limit?: number;
  offset?: number;
}

export const pendingApi = {
  list: ({ status, kind, bucket, limit, offset }: ListParams = {}) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (kind) sp.set("kind", kind);
    if (bucket && bucket !== "all") sp.set("bucket", bucket);
    if (limit !== undefined) sp.set("limit", String(limit));
    if (offset) sp.set("offset", String(offset));
    const qs = sp.toString();
    return apiRequest<PendingProposal[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

  /** Uncapped count for the badge, which must not stop at one page. */
  count: () => apiRequest<{ pending: number }>(`${BASE}/count`),

  get: (id: string) => apiRequest<PendingProposal>(`${BASE}/${id}`),

  accept: (id: string, body: AcceptBody = {}) =>
    apiRequest<PendingProposal>(`${BASE}/${id}/accept`, {
      method: "POST",
      body,
    }),

  reject: (id: string, body: RejectBody = {}) =>
    apiRequest<PendingProposal>(`${BASE}/${id}/reject`, {
      method: "POST",
      body,
    }),

  /** Reverse an accepted proposal: the record goes, the proposal comes back. */
  undo: (id: string) => apiRequest<PendingProposal>(`${BASE}/${id}/undo`, { method: "POST" }),

  /** Put a rejected proposal back in the queue. Nothing was written to reverse. */
  reopen: (id: string) => apiRequest<PendingProposal>(`${BASE}/${id}/reopen`, { method: "POST" }),

  bulkAccept: (proposalIds: string[]) =>
    apiRequest<PendingProposal[]>(`${BASE}/bulk-accept`, {
      method: "POST",
      body: { proposal_ids: proposalIds },
    }),
};
