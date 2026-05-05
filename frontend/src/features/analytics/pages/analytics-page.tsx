import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { apiRequest } from "@features/documents/api/http";
import { formatCLP } from "@/lib/locale-cl";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { CHART_COLORS, CHART_HEIGHT } from "@shared/lib/chart-config";
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

export function AnalyticsPage() {
  const queryClient = useQueryClient();

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analytics"] }),
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
    <PageLayout width="lg">
      <PageHeader
        title="Analítica"
        description="Métricas internas (solo ADMIN). Refresca las materialized views si cambian datos recientes."
        actions={
          <Button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            variant="outline"
            size="sm"
            className="gap-1"
          >
            {refresh.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refrescar
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiCard label="Ingresos totales" value={formatCLP(totalIn / 100)} />
          <KpiCard label="Gastos totales" value={formatCLP(totalOut / 100)} tone="destructive" />
          <KpiCard label="Pendientes Anita" value={String(pending.data?.pending_count ?? 0)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue mensual</CardTitle>
            </CardHeader>
            <CardContent>
              {revenue.isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : revenueByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Sin transacciones aún.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <LineChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCLP(v / 100)} />
                    <Tooltip
                      formatter={(v) => formatCLP(Number(v) / 100)}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="in_cents"
                      name="Ingresos"
                      stroke={CHART_COLORS.success}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="out_cents"
                      name="Gastos"
                      stroke={CHART_COLORS.error}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funnel (último mes)</CardTitle>
            </CardHeader>
            <CardContent>
              {funnel.isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : funnelLatest.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Sin oportunidades aún.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <BarChart data={funnelLatest}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="Oportunidades">
                      {funnelLatest.map((_, i) => (
                        <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ad ROI por campaña</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {adRoi.isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Campaña</th>
                    <th className="py-2 pr-4">Canal</th>
                    <th className="py-2 pr-4">Presupuesto</th>
                    <th className="py-2 pr-4">Gastado</th>
                    <th className="py-2 pr-4">Ganadas</th>
                    <th className="py-2 pr-4">Valor ganado</th>
                    <th className="py-2 pr-4">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {adRoi.data?.map((r) => {
                    const roi =
                      r.spend_cents > 0
                        ? ((r.won_value_cents - r.spend_cents) / r.spend_cents) * 100
                        : null;
                    return (
                      <tr key={r.campaign_id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{r.campaign_name}</td>
                        <td className="py-2 pr-4">{r.channel}</td>
                        <td className="py-2 pr-4">
                          {r.budget_cents != null ? formatCLP(r.budget_cents / 100) : "—"}
                        </td>
                        <td className="py-2 pr-4">{formatCLP(r.spend_cents / 100)}</td>
                        <td className="py-2 pr-4">{r.won_count}</td>
                        <td className="py-2 pr-4">{formatCLP(r.won_value_cents / 100)}</td>
                        <td
                          className={
                            "py-2 pr-4 " +
                            (roi == null ? "" : roi >= 0 ? "text-success" : "text-destructive")
                          }
                        >
                          {roi == null ? "—" : `${roi.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline activo</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <div className="space-y-1 text-sm">
                {[...(pipeline.data ?? [])]
                  .sort(
                    (a, b) =>
                      STAGE_ORDER.indexOf(a.pipeline_stage) - STAGE_ORDER.indexOf(b.pipeline_stage),
                  )
                  .map((p) => (
                    <div
                      key={p.pipeline_stage}
                      className="flex justify-between border-b py-1 last:border-0"
                    >
                      <span>{p.pipeline_stage}</span>
                      <span className="text-muted-foreground">
                        {p.opp_count} • {formatCLP(p.expected_value_cents / 100)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={"text-2xl font-semibold " + (tone === "destructive" ? "text-destructive" : "")}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
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
    stage,
    count: byStage.get(stage) ?? 0,
  }));
}
