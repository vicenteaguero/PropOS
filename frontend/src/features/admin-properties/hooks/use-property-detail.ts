import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";
import { propertiesApi } from "../api/properties-api";

/** A per-property access grant, as `/v1/properties/{id}/grants` returns it. */
export interface ApiGrant {
  id: string;
  user_id: string;
  view: string;
  capabilities: string[];
}

/**
 * The property detail's query keys, in one place.
 *
 * They were written inline in the detail page, which was fine until something
 * else needed to warm the same cache: a prefetch built from a key that differs
 * by a character populates an entry nobody reads, and it fails silently — the
 * page just fetches again as if nothing had happened. `core/query/warmup.tsx`
 * documents the same rule for the login-time prefetch.
 */
export const propertyKeys = {
  detail: (id: string) => ["admin", "property", id] as const,
  grants: (id: string) => ["admin", "property", id, "grants"] as const,
};

export const propertyQueries = {
  detail: (id: string) => ({
    queryKey: propertyKeys.detail(id),
    queryFn: () => propertiesApi.get(id),
  }),
  grants: (id: string) => ({
    queryKey: propertyKeys.grants(id),
    queryFn: () => apiRequest<ApiGrant[]>(`/v1/properties/${id}/grants`),
  }),
};

export function useProperty(id: string | undefined) {
  return useQuery({ ...propertyQueries.detail(id ?? ""), enabled: !!id });
}

export function usePropertyGrants(id: string | undefined) {
  return useQuery({ ...propertyQueries.grants(id ?? ""), enabled: !!id });
}
