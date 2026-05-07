import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@features/documents/api/http";
import { useAuth } from "@shared/hooks/use-auth";

interface TenantBranding {
  agentName: string;
  defaultPaperSize: string;
}

interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  settings: {
    ai_assistant_name: string;
    default_paper_size: string;
  };
}

const DEFAULT: TenantBranding = {
  agentName: "Anita",
  defaultPaperSize: "A4",
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
    return {
      agentName: query.data.settings.ai_assistant_name || DEFAULT.agentName,
      defaultPaperSize: query.data.settings.default_paper_size || DEFAULT.defaultPaperSize,
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
