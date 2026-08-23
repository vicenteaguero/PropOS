import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";
import { PageLayout } from "@shared/components/page-layout";
import { ChartCard, ErrorState, PageSkeleton, Pill, StatCard } from "@shared/ui";
import { CHART_COLORS, CHART_HEIGHT } from "@shared/lib/chart-config";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface AgentCost {
  totals: {
    tokens_in: number;
    tokens_out: number;
    cost_cents: number;
    message_count: number;
  };
  by_session: {
    session_id: string;
    tokens_in: number;
    tokens_out: number;
    cost_cents: number;
    messages: number;
    provider: string | null;
    model: string | null;
    last_at: string | null;
  }[];
  by_day: { day: string; cost_cents: number }[];
}

const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(4)}`;

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};

export function AgentCostPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics", "agent-cost"],
    queryFn: () => apiRequest<AgentCost>("/v1/analytics/agent-cost"),
  });

  if (isLoading) {
    return (
      <PageLayout width="lg" noPadding className="lg:max-w-none">
        <div className="px-[var(--page-x)] pt-6 lg:px-8">
          <PageSkeleton variant="kpi-grid" />
        </div>
      </PageLayout>
    );
  }
  if (!data) {
    return (
      <PageLayout width="lg" noPadding className="lg:max-w-none">
        <div className="mx-5 mt-6 lg:mx-8">
          <ErrorState
            message="No se pudieron cargar los costos."
            error={error}
            onRetry={() => refetch()}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    // Mobile: capped centered column (unchanged). Desktop: full-bleed dashboard.
    <PageLayout width="lg" noPadding className="pb-10 lg:max-w-none">
      <div className="px-[var(--page-x)] pt-5 pb-4 lg:px-8 lg:pt-7"></div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 px-[var(--page-x)] lg:grid-cols-4 lg:gap-4 lg:px-8">
        <StatCard label="Mensajes" value={String(data.totals.message_count)} />
        <StatCard label="Tokens entrada" value={data.totals.tokens_in.toLocaleString()} />
        <StatCard label="Tokens salida" value={data.totals.tokens_out.toLocaleString()} />
        <StatCard label="Costo total" value={fmtUSD(data.totals.cost_cents)} tone="ink" />
      </div>

      {/* Daily cost */}
      <div className="mt-3 px-[var(--page-x)] lg:mt-4 lg:px-8">
        <ChartCard title="Costo por día">
          {data.by_day.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin actividad aún.</p>
          ) : (
            <div style={{ height: CHART_HEIGHT }} className="w-full lg:!h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="day" tick={AXIS_TICK} stroke="var(--border)" />
                  <YAxis tick={AXIS_TICK} stroke="var(--border)" tickFormatter={(v) => fmtUSD(v)} />
                  <Tooltip
                    formatter={(v) => fmtUSD(Number(v))}
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "var(--secondary)" }}
                  />
                  <Bar dataKey="cost_cents" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Sessions */}
      <div className="mt-3 px-[var(--page-x)] lg:mt-4 lg:px-8">
        <ChartCard title="Sesiones (top 50 recientes)">
          {data.by_session.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin sesiones aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pr-4 font-medium">Sesión</th>
                    <th className="py-2.5 pr-4 font-medium">Último mensaje</th>
                    <th className="py-2.5 pr-4 font-medium">Proveedor</th>
                    <th className="py-2.5 pr-4 font-medium">Mensajes</th>
                    <th className="py-2.5 pr-4 font-medium">Tokens entrada</th>
                    <th className="py-2.5 pr-4 font-medium">Tokens salida</th>
                    <th className="py-2.5 pr-4 font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_session.map((s) => (
                    <tr key={s.session_id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {s.session_id.slice(0, 8)}…
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {s.last_at ? s.last_at.slice(0, 16).replace("T", " ") : "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        {s.provider ? (
                          <Pill tone="neutral">
                            {s.provider}
                            {s.model ? ` · ${s.model}` : ""}
                          </Pill>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{s.messages}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {s.tokens_in.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {s.tokens_out.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-foreground">
                        {fmtUSD(s.cost_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AgentCostPage;
