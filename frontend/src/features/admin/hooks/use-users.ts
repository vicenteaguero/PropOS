import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "@features/admin/services/users-api";
import type { User } from "@features/admin/types";

const USERS_QUERY_KEY = ["users"] as const;

export function useUsers() {
  return useQuery<User[], Error>({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchUsers();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
