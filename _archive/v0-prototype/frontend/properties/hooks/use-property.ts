import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProperty } from "@features/properties/services/properties-api";
import type { Property } from "@features/properties/types";

const PROPERTY_QUERY_KEY = "property" as const;

export function useProperty(id: string) {
  const queryClient = useQueryClient();

  return useQuery<Property, Error>({
    queryKey: [PROPERTY_QUERY_KEY, id],
    queryFn: async () => {
      const result = await fetchProperty(id);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: Boolean(id),
    // Use cached data from the properties list for instant render
    initialData: () => {
      const properties = queryClient.getQueryData<Property[]>(["properties"]);
      return properties?.find((p) => p.id === id);
    },
    // Mark initialData as potentially stale so it refetches in background
    initialDataUpdatedAt: () => {
      return queryClient.getQueryState(["properties"])?.dataUpdatedAt;
    },
  });
}
