import { useQuery } from "@tanstack/react-query";
import { ENV } from "@core/config/env";

type HealthStatus = "healthy" | "degraded" | "down";

interface HealthCheckResult {
  status: HealthStatus;
  latency: number;
}

export function useHealthCheck() {
  return useQuery<HealthCheckResult>({
    queryKey: ["health-check"],
    queryFn: async () => {
      const start = Date.now();
      try {
        const response = await fetch(`${ENV.API_URL}/health`);
        const latency = Date.now() - start;

        if (!response.ok) {
          return { status: "down" as const, latency };
        }

        const status: HealthStatus =
          latency < 1000 ? "healthy" : latency < 3000 ? "degraded" : "down";
        return { status, latency };
      } catch {
        return { status: "down" as const, latency: Date.now() - start };
      }
    },
    refetchInterval: 60_000,
    retry: false,
  });
}
