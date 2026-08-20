import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";

/** Mirrors `note_target_kind` in the database and `EntityKind` on the API. */
export type EntityKind = "PROPERTY" | "CONTACT" | "OPPORTUNITY" | "EVENT" | "PROJECT" | "PLACE";

export interface EntityHit {
  kind: EntityKind;
  id: string;
  label: string;
  sub: string | null;
}

export const entitySearchKeys = {
  search: (kind: EntityKind, q: string) => ["search", "entities", kind, q] as const,
};

/**
 * One search endpoint for every record type a picker can link to.
 *
 * Before this, pickers hit the per-feature list endpoints, so only the two that
 * happened to accept a `q` — properties and contacts — were reachable. A note
 * can point at six kinds; the other four had no way in at all.
 */
export function useEntitySearch(kind: EntityKind | null, q: string, enabled = true) {
  return useQuery({
    queryKey: entitySearchKeys.search(kind ?? "PROPERTY", q),
    queryFn: () => {
      const params = new URLSearchParams({ kind: kind as string });
      if (q.trim()) params.set("q", q.trim());
      return apiRequest<EntityHit[]>(`/v1/search/entities?${params.toString()}`);
    },
    enabled: enabled && !!kind,
    staleTime: 30_000,
  });
}
