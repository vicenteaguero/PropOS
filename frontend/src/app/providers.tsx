import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthContext, useAuthProvider } from "@shared/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ENV } from "@core/config/env";
import { AgentBrandingProvider } from "@core/branding/agent-branding";
import { ViewAsProvider } from "@core/view-as/view-as";

// Warm up backend — triggers Cloud Run cold start while user sees login screen
fetch(`${ENV.API_URL}/health`).catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AgentBrandingProvider>
            <ViewAsProvider>
              <TooltipProvider>
                {children}
                <Toaster
                  theme="dark"
                  toastOptions={{
                    style: {
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--card-foreground)",
                    },
                  }}
                />
              </TooltipProvider>
            </ViewAsProvider>
          </AgentBrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
