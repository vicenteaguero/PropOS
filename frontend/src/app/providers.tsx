import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthContext, useAuthProvider } from "@shared/hooks/use-auth";
import { ENV } from "@core/config/env";

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
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
