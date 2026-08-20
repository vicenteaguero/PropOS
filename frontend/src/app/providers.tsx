import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter } from "react-router-dom";
import { AuthContext, useAuthProvider } from "@shared/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ENV } from "@core/config/env";
import { AgentBrandingProvider } from "@core/branding/agent-branding";
import { ThemeProvider, useThemeMode } from "@core/theme/theme-provider";
import { ThemeController } from "@core/theme/theme-controller";
import { idbPersister } from "@core/query/persister";
import { QueryWarmup } from "@core/query/warmup";
import { RefreshIndicator } from "@core/query/refresh-indicator";

// Warm up backend — triggers Cloud Run cold start while user sees login screen
fetch(`${ENV.API_URL}/health`).catch(() => {});

/** A day: the persisted cache is a starting point, not a source of truth. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Half an hour, not the 5-minute default. Coming back to a tab after a
      // coffee used to be a cold fetch of everything, which is most of what
      // "the app feels slow" meant.
      gcTime: 30 * 60 * 1000,
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: CACHE_MAX_AGE_MS }}
    >
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AgentBrandingProvider>
              <ThemeController />
              <QueryWarmup />
              <RefreshIndicator />
              <TooltipProvider>
                {children}
                <ThemedToaster />
              </TooltipProvider>
            </AgentBrandingProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
