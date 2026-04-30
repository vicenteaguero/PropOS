import { apiRequest } from "@features/documents/api/http";
import type { PendingProposal } from "@features/anita/types";

const BASE = "/v1/pending";

export interface AcceptBody {
  overrides?: Record<string, unknown>;
  disambiguation?: Record<string, string>;
  note?: string;
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

  reject: (id: string, reason?: string) =>
    apiRequest<PendingProposal>(`${BASE}/${id}/reject`, {
      method: "POST",
      body: { reason },
    }),

  bulkAccept: (proposalIds: string[]) =>
    apiRequest<PendingProposal[]>(`${BASE}/bulk-accept`, {
      method: "POST",
      body: { proposal_ids: proposalIds },
    }),
};
