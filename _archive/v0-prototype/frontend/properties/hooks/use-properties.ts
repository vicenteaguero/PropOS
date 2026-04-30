import { useQuery } from "@tanstack/react-query";
import { fetchProperties } from "@features/properties/services/properties-api";
import type { Property } from "@features/properties/types";

const PROPERTIES_QUERY_KEY = ["properties"] as const;

export function useProperties() {
  return useQuery<Property[], Error>({
    queryKey: PROPERTIES_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchProperties();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
