import { apiRequest } from "@shared/api/http";
import type { Interaction, InteractionInput } from "../types";
import { qs } from "@shared/lib/query-string";

export interface ListInteractionsParams {
  kind?: string;
  person_id?: string;
  property_id?: string;
  limit?: number;
}

export const interactionsApi = {
  list: (params: ListInteractionsParams = {}) =>
    apiRequest<Interaction[]>(`/v1/interactions${qs({ ...params })}`),
  get: (id: string) => apiRequest<Interaction>(`/v1/interactions/${id}`),
  create: (body: InteractionInput) =>
    apiRequest<Interaction>("/v1/interactions", { method: "POST", body }),
  remove: (id: string) => apiRequest<void>(`/v1/interactions/${id}`, { method: "DELETE" }),
};
