import { apiRequest } from "@shared/api/http";
import type { Interaction, InteractionInput } from "../types";

export interface ListInteractionsParams {
  kind?: string;
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

export const interactionsApi = {
  list: (params: ListInteractionsParams = {}) =>
    apiRequest<Interaction[]>(`/v1/interactions${qs({ ...params })}`),
  get: (id: string) => apiRequest<Interaction>(`/v1/interactions/${id}`),
  create: (body: InteractionInput) =>
    apiRequest<Interaction>("/v1/interactions", { method: "POST", body }),
  remove: (id: string) => apiRequest<void>(`/v1/interactions/${id}`, { method: "DELETE" }),
};
