import { apiRequest } from "@shared/api/http";
import type { Opportunity, OpportunityInput } from "../types";
import { qs } from "@shared/lib/query-string";

export interface ListOpportunitiesParams {
  status?: string;
  stage?: string;
  person_id?: string;
  property_id?: string;
  limit?: number;
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
