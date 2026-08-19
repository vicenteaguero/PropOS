import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { apiRequest } from "@shared/api/http";
import type { UserView } from "@shared/types/auth";
import { buildGroups, filterByScope, type NavGroup } from "./nav-items";

// React bindings for the navigation tree. Kept apart from nav-items.ts so the
// tree itself stays pure data — importable by a unit test without booting the
// Supabase client that useAuth pulls in transitively.

/** Live count for the Pendientes badge, shared by both shells. */
export function usePendingCount(): number {
  const query = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return query.data?.pending_count ?? 0;
}

/**
 * The groups the current user may actually see, already filtered by role, admin
 * scope and dev flag. Both shells call this so neither can drift from the other.
 */
export function useNavGroups(): { groups: NavGroup[]; view: UserView; isAdminView: boolean } {
  const { user } = useAuth();
  const agentName = useAgentName();
  const view: UserView = (user?.view as UserView | undefined) ?? "agent";
  const groups = filterByScope(
    buildGroups(view, agentName, !!user?.isDevAdmin),
    user?.adminScope ?? [],
  );
  return { groups, view, isAdminView: view === "admin" || view === "admin-dev" };
}
