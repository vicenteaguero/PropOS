import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthContext, useAuthProvider } from "@shared/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ENV } from "@core/config/env";
import { AgentBrandingProvider } from "@core/branding/agent-branding";
import { ThemeProvider, useThemeMode } from "@core/theme/theme-provider";
import { ThemeController } from "@core/theme/theme-controller";

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

function ThemedToaster() {
  const { theme } = useThemeMode();
  return (
    <Toaster
      theme={theme}
      toastOptions={{
        style: {
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--card-foreground)",
        },
      }}
    />
  );
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AgentBrandingProvider>
              <ThemeController />
              <TooltipProvider>
                {children}
                <ThemedToaster />
              </TooltipProvider>
            </AgentBrandingProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
