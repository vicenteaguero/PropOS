import { useQuery } from "@tanstack/react-query";
import { opportunitiesApi } from "@features/opportunities/api/opportunities-api";

/**
 * The open deal a property belongs to, if there is exactly one.
 *
 * Documents have no deal column — `document_assignments` only admits contacts,
 * properties and internal areas — but a document about a flat is in practice a
 * document about whatever deal that flat is in. Deriving it costs one filtered
 * list call and no schema change.
 *
 * Deliberately returns nothing when a property is in more than one open deal:
 * guessing which one a mandate belongs to would be worse than staying quiet.
 */
export function useDealForProperty(propertyId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["deals", "for-property", propertyId],
    queryFn: () => opportunitiesApi.list({ property_id: propertyId as string, status: "OPEN" }),
    enabled: !!propertyId,
    staleTime: 60_000,
  });
  const deals = query.data ?? [];
  return { deal: deals.length === 1 ? deals[0] : null, isLoading: query.isLoading };
}
