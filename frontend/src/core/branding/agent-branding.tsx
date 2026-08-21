import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";
import { useAuth } from "@shared/hooks/use-auth";

interface TenantBranding {
  agentName: string;
  defaultPaperSize: string;
  brandColor: string | null;
  /** Surface tint percentage, 0-12. See applyTenantAccent. */
  brandTint: number | null;
  slug: string | null;
  /** False until /v1/tenants/me answers — the rest of this object is defaults. */
  resolved: boolean;
}

interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  settings?: {
    ai_assistant_name?: string;
    default_paper_size?: string;
    brand_color?: string | null;
    brand_tint?: number | null;
  };
}

const DEFAULT: TenantBranding = {
  agentName: "Propo",
  defaultPaperSize: "A4",
  brandColor: null,
  brandTint: null,
  slug: null,
  resolved: false,
};

const AgentBrandingContext = createContext<TenantBranding>(DEFAULT);

export function AgentBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useQuery<TenantResponse>({
    queryKey: ["tenant", "me"],
    queryFn: () => apiRequest<TenantResponse>("/v1/tenants/me"),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const value = useMemo<TenantBranding>(() => {
    if (!query.data) return DEFAULT;
    // Guarded: this provider wraps the entire app, so a tenant row that comes
    // back without `settings` used to throw during render and white-screen
    // every page rather than just losing the custom agent name.
    const settings = query.data.settings;
    return {
      agentName: settings?.ai_assistant_name || DEFAULT.agentName,
      defaultPaperSize: settings?.default_paper_size || DEFAULT.defaultPaperSize,
      brandColor: settings?.brand_color || null,
      brandTint: typeof settings?.brand_tint === "number" ? settings.brand_tint : null,
      slug: query.data.slug || null,
      resolved: true,
    };
  }, [query.data]);

  return <AgentBrandingContext.Provider value={value}>{children}</AgentBrandingContext.Provider>;
}

export function useAgentName(): string {
  return useContext(AgentBrandingContext).agentName;
}

export function useTenantBranding(): TenantBranding {
  return useContext(AgentBrandingContext);
}
