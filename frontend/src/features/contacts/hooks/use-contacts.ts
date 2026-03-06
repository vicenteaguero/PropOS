import { useQuery } from "@tanstack/react-query";
import { fetchContacts } from "@features/contacts/services/contacts-api";
import type { Contact } from "@features/contacts/types";

const CONTACTS_QUERY_KEY = ["contacts"] as const;

export function useContacts() {
  return useQuery<Contact[], Error>({
    queryKey: CONTACTS_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchContacts();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
