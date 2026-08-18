import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, RoundButton } from "@shared/ui";
import { apiRequest } from "@features/documents/api/http";
import { formatCLP } from "@/lib/locale-cl";
import { label } from "@shared/lib/labels";
import { PageLayout } from "@shared/components/page-layout";
import { CHART_COLORS, CHART_HEIGHT } from "@shared/lib/chart-config";
import { useAgentName } from "@core/branding/agent-branding";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenueRow {
  month: string;
  direction: "IN" | "OUT";
  category: string;
  total_cents: number;
  tx_count: number;
}

interface PendingCount {
  pending_count: number;
}

interface PipelineRow {
  pipeline_stage: string;
  opp_count: number;
  expected_value_cents: number;
}

interface AdRoiRow {
  campaign_id: string;
  campaign_name: string;
  channel: string;
  budget_cents: number | null;
  spend_cents: number;
  won_count: number;
  won_value_cents: number;
}

interface FunnelRow {
  month: string;
  pipeline_stage: string;
  status: string;
  opp_count: number;
}

const STAGE_ORDER = ["LEAD", "QUALIFIED", "VISIT", "OFFER", "RESERVATION", "CLOSED"];
const STAGE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.accent,
  CHART_COLORS.surface,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.neutral,
];

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const agentName = useAgentName();

  const revenue = useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: () => apiRequest<RevenueRow[]>("/v1/analytics/revenue-monthly"),
  });
  const pending = useQuery({
    queryKey: ["analytics", "pending"],
    queryFn: () => apiRequest<PendingCount>("/v1/analytics/pending-count"),
  });
  const pipeline = useQuery({
    queryKey: ["analytics", "pipeline"],
    queryFn: () => apiRequest<PipelineRow[]>("/v1/analytics/pipeline"),
  });
  const adRoi = useQuery({
    queryKey: ["analytics", "ad-roi"],
    queryFn: () => apiRequest<AdRoiRow[]>("/v1/analytics/ad-roi"),
  });
  const funnel = useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: () => apiRequest<FunnelRow[]>("/v1/analytics/funnel-monthly"),
  });

  const refresh = useMutation({
    mutationFn: () => apiRequest<{ ok: boolean }>("/v1/analytics/refresh", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Vistas actualizadas");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudieron refrescar las vistas"),
  });

  const totalIn = (revenue.data ?? [])
    .filter((r) => r.direction === "IN")
    .reduce((acc, r) => acc + r.total_cents, 0);
  const totalOut = (revenue.data ?? [])
    .filter((r) => r.direction === "OUT")
    .reduce((acc, r) => acc + r.total_cents, 0);

  const revenueByMonth = aggregateRevenueByMonth(revenue.data ?? []);
  const funnelLatest = aggregateFunnelLatestMonth(funnel.data ?? []);

  return (
    // Mobile: capped centered column (unchanged). Desktop: full-bleed dashboard.
    <PageLayout width="lg" noPadding className="pb-10 lg:max-w-none">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground lg:text-[30px]">
            Analítica
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Métricas internas. Refrescá las vistas si cambian datos recientes.
          </p>
        </div>
        <RoundButton
          tone="muted"
          size={44}
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label="Refrescar"
        >
          {refresh.isPending ? (
            <Loader2 className="size-[18px] animate-spin" strokeWidth={1.8} />
          ) : (
            <RefreshCw className="size-[18px]" strokeWidth={1.8} />
          )}
        </RoundButton>
      </div>

      {/* KPIs — 3-up on mobile, spread across the full width on desktop. */}
      <div className="grid grid-cols-2 gap-3 px-5 md:grid-cols-3 lg:px-8 lg:gap-4">
        <StatCard
          label="Ingresos totales"
          value={statText(revenue, formatCLP(totalIn / 100))}
          tone="ink"
        />
        <StatCard
          label="Gastos totales"
          value={statText(revenue, formatCLP(totalOut / 100))}
          tone="destructive"
        />
        <StatCard
          label={`Pendientes ${agentName}`}
          value={statText(pending, String(pending.data?.pending_count ?? 0))}
        />
      </div>

      {/* Charts */}
      <div className="mt-3 grid grid-cols-1 gap-3 px-5 lg:mt-4 lg:grid-cols-2 lg:gap-4 lg:px-8">
        <ChartCard title="Ingresos por mes">
          <ChartBody
            query={revenue}
            isEmpty={revenueByMonth.length === 0}
            emptyLabel="Sin transacciones aún."
          >
            <ChartFrame>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="month" tick={AXIS_TICK} stroke="var(--border)" />
                  <YAxis
                    tick={AXIS_TICK}
                    stroke="var(--border)"
                    tickFormatter={(v) => formatCLP(v / 100)}
                  />
                  <Tooltip
                    formatter={(v) => formatCLP(Number(v) / 100)}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="in_cents"
                    name="Ingresos"
                    stroke={CHART_COLORS.success}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="out_cents"
                    name="Gastos"
                    stroke={CHART_COLORS.error}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </ChartBody>
        </ChartCard>

        <ChartCard title="Embudo (último mes)">
          <ChartBody
            query={funnel}
            isEmpty={funnelLatest.length === 0}
            emptyLabel="Sin oportunidades aún."
          >
            <ChartFrame>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelLatest}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="stage" tick={AXIS_TICK} stroke="var(--border)" />
                  <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--secondary)" }} />
                  <Bar dataKey="count" name="Oportunidades" radius={[6, 6, 0, 0]}>
                    {funnelLatest.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </ChartBody>
        </ChartCard>
      </div>

      {/* Ad ROI (wide table) + active pipeline (compact) share the width on desktop. */}
      <div className="mt-3 grid grid-cols-1 gap-3 px-5 lg:mt-4 lg:grid-cols-3 lg:gap-4 lg:px-8">
        <div className="lg:col-span-2">
          <ChartCard title="ROI por campaña">
            <ChartBody
              query={adRoi}
              isEmpty={(adRoi.data?.length ?? 0) === 0}
              emptyLabel="Sin campañas aún."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2.5 pr-4 font-medium">Campaña</th>
                      <th className="py-2.5 pr-4 font-medium">Canal</th>
                      <th className="py-2.5 pr-4 font-medium">Presupuesto</th>
                      <th className="py-2.5 pr-4 font-medium">Gastado</th>
                      <th className="py-2.5 pr-4 font-medium">Ganadas</th>
                      <th className="py-2.5 pr-4 font-medium">Valor ganado</th>
                      <th className="py-2.5 pr-4 font-medium">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adRoi.data?.map((r) => {
                      const roi =
                        r.spend_cents > 0
                          ? ((r.won_value_cents - r.spend_cents) / r.spend_cents) * 100
                          : null;
                      return (
                        <tr key={r.campaign_id} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-4 font-medium text-foreground">
                            {r.campaign_name}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{r.channel}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {r.budget_cents != null ? formatCLP(r.budget_cents / 100) : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {formatCLP(r.spend_cents / 100)}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{r.won_count}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {formatCLP(r.won_value_cents / 100)}
                          </td>
                          <td
                            className={
                              "py-2.5 pr-4 font-semibold " +
                              (roi == null
                                ? "text-muted-foreground"
                                : roi >= 0
                                  ? "text-success"
                                  : "text-destructive")
                            }
                          >
                            {roi == null ? "—" : `${roi.toFixed(0)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ChartBody>
          </ChartCard>
        </div>

        {/* Pipeline activo — third column on desktop, full width on mobile. */}
        <div className="lg:col-span-1">
          <ChartCard title="Pipeline activo">
            <ChartBody
              query={pipeline}
              isEmpty={(pipeline.data?.length ?? 0) === 0}
              emptyLabel="Sin pipeline activo."
            >
              <div>
                {[...(pipeline.data ?? [])]
                  .sort(
                    (a, b) =>
                      STAGE_ORDER.indexOf(a.pipeline_stage) - STAGE_ORDER.indexOf(b.pipeline_stage),
                  )
                  .map((p, i, arr) => (
                    <div
                      key={p.pipeline_stage}
                      className={
                        "flex items-center justify-between py-2.5 " +
                        (i < arr.length - 1 ? "border-b border-border" : "")
                      }
                    >
                      <span className="text-sm font-medium text-foreground">
                        {label("pipelineStage", p.pipeline_stage)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {p.opp_count} • {formatCLP(p.expected_value_cents / 100)}
                      </span>
                    </div>
                  ))}
              </div>
            </ChartBody>
          </ChartCard>
        </div>
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
  tone?: "ink" | "destructive";
}) {
  const isInk = tone === "ink";
  return (
    <div
      className={
        "rounded-2xl p-4 " +
        (isInk ? "bg-foreground text-background" : "bg-secondary text-foreground")
      }
    >
      <p
        className={
          "text-[13px] font-medium " + (isInk ? "text-background/70" : "text-muted-foreground")
        }
      >
        {label}
      </p>
      <p
        className={
          "mt-1 text-2xl font-bold tracking-tight " +
          (tone === "destructive" ? "text-destructive" : "")
        }
      >
        {value}
      </p>
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

/**
 * Fixed-height chart frame. Mobile keeps the shared CHART_HEIGHT; desktop gets
 * more vertical room. The inner ResponsiveContainer fills this box at 100%.
 */
function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: CHART_HEIGHT }} className="w-full lg:!h-[340px]">
      {children}
    </div>
  );
}

/** Minimal shape the chart/KPI helpers need from a query result. */
interface QueryState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * KPI text for a query-backed figure. A failed query renders a dash instead of
 * a formatted zero, which would read as a real business number.
 */
function statText(query: { isPending: boolean; isError: boolean }, text: string): string {
  if (query.isPending) return "…";
  if (query.isError) return "—";
  return text;
}

/**
 * Branches a chart body across loading / error / empty / data. Without the error
 * branch a failed materialized view renders as "no data yet", so the admin reads
 * an outage as a real business figure.
 */
function ChartBody({
  query,
  isEmpty,
  emptyLabel,
  children,
}: {
  query: QueryState;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (query.isError) {
    return (
      <ErrorState
        compact
        message="No se pudo cargar este gráfico."
        error={query.error}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <ChartLoading />;
  if (isEmpty) return <ChartEmpty>{emptyLabel}</ChartEmpty>;
  return <>{children}</>;
}

function ChartLoading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>;
}

function aggregateRevenueByMonth(rows: RevenueRow[]) {
  const map = new Map<string, { month: string; in_cents: number; out_cents: number }>();
  for (const r of rows) {
    const slot = map.get(r.month) ?? {
      month: r.month,
      in_cents: 0,
      out_cents: 0,
    };
    if (r.direction === "IN") slot.in_cents += r.total_cents;
    else slot.out_cents += r.total_cents;
    map.set(r.month, slot);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function aggregateFunnelLatestMonth(rows: FunnelRow[]) {
  if (rows.length === 0) return [];
  const latestMonth = [...rows]
    .map((r) => r.month)
    .sort()
    .pop()!;
  const filtered = rows.filter((r) => r.month === latestMonth);
  const byStage = new Map<string, number>();
  for (const r of filtered) {
    byStage.set(r.pipeline_stage, (byStage.get(r.pipeline_stage) ?? 0) + r.opp_count);
  }
  return STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => ({
    stage: label("pipelineStage", stage),
    count: byStage.get(stage) ?? 0,
  }));
}
