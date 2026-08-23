import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";

export interface TenantMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

/**
 * Colleagues in the active workspace.
 *
 * Shared rather than task-local: assigning work, showing who owns what and
 * filtering by person are the same list, and `features/admin-users` — the only
 * previous way to get it — is ADMIN-only, which would have left agents unable
 * to hand a task to anyone.
 */
export function useTenantMembers(enabled = true) {
  return useQuery({
    queryKey: ["tenant", "members"],
    queryFn: () => apiRequest<TenantMember[]>("/v1/users/members"),
    enabled,
    // The roster changes about as often as someone is hired.
    staleTime: 5 * 60_000,
  });
}
