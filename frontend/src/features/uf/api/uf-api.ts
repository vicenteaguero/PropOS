import { apiRequest } from "@features/documents/api/http";

export interface UfPoint {
  date: string;
  value_clp: number;
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
  refresh: () => apiRequest<UfRefreshResponse>("/v1/uf/refresh", { method: "POST" }),
};
