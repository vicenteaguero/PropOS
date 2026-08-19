import { apiRequest } from "@shared/api/http";

export interface UfPoint {
  date: string;
  value_clp: number;
  /** Provider that supplied the row: sii.cl | cmf.cl | mindicador.cl. */
  source?: string | null;
}

export interface UfForwardResponse {
  points: UfPoint[];
}

export interface UfTodayResponse {
  today: UfPoint;
  month_delta_pct: number | null;
  year_delta_pct: number | null;
}

export interface UfRefreshResponse {
  today: UfPoint;
  inserted: boolean;
  backfilled_count: number;
}

export const ufApi = {
  today: () => apiRequest<UfTodayResponse>("/v1/uf/today"),
  forward: () => apiRequest<UfForwardResponse>("/v1/uf/forward"),
  refresh: () => apiRequest<UfRefreshResponse>("/v1/uf/refresh", { method: "POST" }),
};
