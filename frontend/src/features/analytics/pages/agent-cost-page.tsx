import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";
import { PageLayout } from "@shared/components/page-layout";
import { Pill } from "@shared/ui";
import { CHART_COLORS, CHART_HEIGHT } from "@shared/lib/chart-config";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAgentName } from "@core/branding/agent-branding";

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
  const agentName = useAgentName();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "agent-cost"],
    queryFn: () => apiRequest<AgentCost>("/v1/analytics/agent-cost"),
  });

  if (isLoading) {
    return (
      <PageLayout width="lg" noPadding>
        <div className="flex min-h-[40vh] justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }
  if (isError || !data) {
    return (
      <PageLayout width="lg" noPadding>
        <div className="mx-5 mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No pude cargar costos.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="lg" noPadding className="pb-10">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Costo {agentName}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Tokens y USD acumulados (últimos 30 días).
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-4">
        <StatCard label="Mensajes" value={String(data.totals.message_count)} />
        <StatCard label="Tokens entrada" value={data.totals.tokens_in.toLocaleString()} />
        <StatCard label="Tokens salida" value={data.totals.tokens_out.toLocaleString()} />
        <StatCard label="Costo total" value={fmtUSD(data.totals.cost_cents)} tone="ink" />
      </div>

      {/* Daily cost */}
      <div className="mt-3 px-5">
        <ChartCard title="Costo por día">
          {data.by_day.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin actividad aún.</p>
          ) : (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
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
          )}
        </ChartCard>
      </div>

      {/* Sessions */}
      <div className="mt-3 px-5">
        <ChartCard title="Sesiones (top 50 recientes)">
          {data.by_session.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin sesiones aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pr-4 font-medium">Sesión</th>
                    <th className="py-2.5 pr-4 font-medium">Última msg</th>
                    <th className="py-2.5 pr-4 font-medium">Provider</th>
                    <th className="py-2.5 pr-4 font-medium">Mensajes</th>
                    <th className="py-2.5 pr-4 font-medium">Tokens in</th>
                    <th className="py-2.5 pr-4 font-medium">Tokens out</th>
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ink";
}) {
  const isInk = tone === "ink";
  return (
    <div
      className={
        "rounded-2xl p-4 " + (isInk ? "bg-foreground text-background" : "bg-secondary text-foreground")
      }
    >
      <p
        className={
          "text-[13px] font-medium " + (isInk ? "text-background/70" : "text-muted-foreground")
        }
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </div>
  );
}
