import { useHealthCheck } from "@shared/hooks/use-health-check";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STATUS_CONFIG = {
  healthy: { color: "bg-success", label: "API conectada" },
  degraded: { color: "bg-warning", label: "API lenta" },
  down: { color: "bg-destructive", label: "API sin conexion" },
} as const;

export function HealthIndicator() {
  const { data } = useHealthCheck();
  const status = data?.status ?? "down";
  const latency = data?.latency;
  const config = STATUS_CONFIG[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <span className={`size-2 rounded-full ${config.color}`} />
          <span className="hidden sm:inline">{config.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {config.label}
          {latency != null ? ` (${latency}ms)` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
