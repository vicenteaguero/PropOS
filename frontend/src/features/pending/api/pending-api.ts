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

export const pendingApi = {
  list: (status?: string, kind?: string) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (kind) sp.set("kind", kind);
    const qs = sp.toString();
    return apiRequest<PendingProposal[]>(`${BASE}${qs ? `?${qs}` : ""}`);
  },

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

  bulkAccept: (proposalIds: string[]) =>
    apiRequest<PendingProposal[]>(`${BASE}/bulk-accept`, {
      method: "POST",
      body: { proposal_ids: proposalIds },
    }),
};
