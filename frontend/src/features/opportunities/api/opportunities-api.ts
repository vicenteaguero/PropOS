import { apiRequest } from "@features/documents/api/http";
import type { Opportunity, OpportunityInput } from "../types";

export interface ListOpportunitiesParams {
  status?: string;
  stage?: string;
  person_id?: string;
  property_id?: string;
  limit?: number;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const opportunitiesApi = {
  list: (params: ListOpportunitiesParams = {}) =>
    apiRequest<Opportunity[]>(`/v1/opportunities${qs({ ...params })}`),
  get: (id: string) => apiRequest<Opportunity>(`/v1/opportunities/${id}`),
  create: (body: OpportunityInput) =>
    apiRequest<Opportunity>("/v1/opportunities", { method: "POST", body }),
  update: (id: string, body: Partial<OpportunityInput>) =>
    apiRequest<Opportunity>(`/v1/opportunities/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/opportunities/${id}`, { method: "DELETE" }),
};
