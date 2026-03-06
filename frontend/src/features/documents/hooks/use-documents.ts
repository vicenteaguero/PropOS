import { useQuery } from "@tanstack/react-query";
import { fetchDocuments } from "@features/documents/services/documents-api";
import type { Document } from "@features/documents/types";

const DOCUMENTS_QUERY_KEY = ["documents"] as const;

export function useDocuments() {
  return useQuery<Document[], Error>({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchDocuments();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
