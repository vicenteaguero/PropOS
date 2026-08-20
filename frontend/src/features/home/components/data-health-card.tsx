import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { apiRequest } from "@shared/api/http";
import { useAuth } from "@shared/hooks/use-auth";
import { cn } from "@/lib/utils";

type Severity = "ERROR" | "WARNING";

interface Finding {
  code: string;
  severity: Severity;
  title: string;
  hint: string;
  count: number;
  path: string | null;
}

interface DataHealth {
  findings: Finding[];
  total: number;
}

export const dataHealthKey = ["data-health"] as const;

/**
 * Rows the database accepts and the business cannot use.
 *
 * These states accumulate silently — an import that half-matched, a listing
 * published before its price was set — and nothing in the app ever mentioned
 * them, so the first symptom was a report coming out wrong. Surfacing the count
 * where the broker already looks turns a silent data problem into a task.
 */
export function DataHealthCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();

  const { data } = useQuery<DataHealth>({
    queryKey: dataHealthKey,
    queryFn: () => apiRequest<DataHealth>("/v1/data-health"),
    // Consistency drifts over hours, not seconds; re-checking on every mount
    // would scan the tenant for nothing.
    staleTime: 10 * 60_000,
  });

  // Defensive: this renders on the home screen, so a payload shaped other than
  // expected — an old worker serving a cached response, a proxy returning [] —
  // must degrade to nothing rather than white-screen the first thing a broker
  // sees. It cost a crash on every viewport in the device sweep.
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  if (!data) return null;

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-[13px] text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-success" strokeWidth={1.9} />
        Sin inconsistencias en tus datos.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {findings.slice(0, 3).map((f, i) => (
        <button
          key={f.code}
          type="button"
          onClick={() => f.path && navigate(`/${role}/${f.path}`)}
          className={cn(
            "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-secondary/50",
            i > 0 && "border-t border-border",
          )}
        >
          <AlertTriangle
            className={cn(
              "size-4 shrink-0",
              f.severity === "ERROR" ? "text-destructive" : "text-warning",
            )}
            strokeWidth={1.9}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-foreground">
              {f.title}
            </span>
            <span className="block truncate text-[12px] text-muted-foreground">{f.hint}</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
            {f.count}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
