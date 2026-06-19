import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@shared/hooks/use-auth";
import type { UserView } from "@shared/types/auth";

/** Broker views get the mobile bottom-nav; everyone else keeps the sidebar. */
const BOTTOM_NAV_VIEWS: ReadonlySet<UserView> = new Set<UserView>(["admin", "admin-dev", "agent"]);

export type ShellMode = "bottom-nav" | "sidebar";

/**
 * Which app shell to render. Bottom-nav on mobile for broker roles
 * (ADMIN/AGENT); restyled sidebar otherwise (desktop, or owner/buyer/content).
 * Purely presentational — route gating is unchanged.
 */
export function useShellMode(): ShellMode {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const view = (user?.view as UserView | undefined) ?? "agent";
  return isMobile && BOTTOM_NAV_VIEWS.has(view) ? "bottom-nav" : "sidebar";
}
