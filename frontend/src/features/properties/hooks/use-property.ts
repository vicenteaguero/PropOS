import { useQuery } from "@tanstack/react-query";
import { fetchProperty } from "@features/properties/services/properties-api";
import type { Property } from "@features/properties/types";

const PROPERTY_QUERY_KEY = "property" as const;

export function useProperty(id: string) {
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
  });
}
