import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@features/documents/api/http";
import { useConversations } from "@features/client-chat/hooks/use-client-chat";
import { useEmailThreads } from "@features/email/hooks/use-email";
import { STAGE_LABELS } from "@features/opportunities/types";
import { CHART_COLORS, CHART_HEIGHT } from "@shared/lib/chart-config";

interface PipelineRow {
  pipeline_stage: string;
  opp_count: number;
  expected_value_cents: number;
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

// WhatsApp / Email channel accents for the donut. CSS vars only (no raw hex).
const CHANNEL_COLORS = ["var(--chart-1)", "var(--chart-3)"];

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  fontSize: 12,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--foreground)",
};

/**
 * Métricas tab. Reuses the existing analytics `/pipeline` endpoint for the
 * stage bar chart, and the bandeja data hooks (conversations + email threads)
 * for the channel split donut — both real data, nothing fabricated.
 *
 * NOTE: the mockup also shows "tiempo de respuesta promedio" and
 * "conversión lead→visita" KPIs. There is no backend query for response time,
 * and conversion is approximated from open-pipeline stage counts (no historical
 * funnel hook is exposed here). Rendered only what is available.
 */
export function CrmMetrics() {
  const pipeline = useQuery({
    queryKey: ["analytics", "pipeline"],
    queryFn: () => apiRequest<PipelineRow[]>("/v1/analytics/pipeline"),
  });
  const convos = useConversations();
  const emails = useEmailThreads({});

  const stageData = useMemo(() => {
    const byStage = new Map<string, number>();
    for (const r of pipeline.data ?? []) {
      byStage.set(r.pipeline_stage, (byStage.get(r.pipeline_stage) ?? 0) + r.opp_count);
    }
    return STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => ({
      stage: STAGE_LABELS[stage] ?? stage,
      count: byStage.get(stage) ?? 0,
    }));
  }, [pipeline.data]);

  // Lead→visita conversion approximated from current open-pipeline counts:
  // (#VISIT or later) / (#total). Not a historical funnel — see NOTE above.
  const conversion = useMemo(() => {
    const rows = pipeline.data ?? [];
    const total = rows.reduce((acc, r) => acc + r.opp_count, 0);
    if (total === 0) return null;
    const reachedVisit = rows
      .filter((r) => STAGE_ORDER.indexOf(r.pipeline_stage) >= STAGE_ORDER.indexOf("VISIT"))
      .reduce((acc, r) => acc + r.opp_count, 0);
    return Math.round((reachedVisit / total) * 100);
  }, [pipeline.data]);

  const channelData = useMemo(() => {
    const wa = convos.data?.length ?? 0;
    const em = emails.data?.length ?? 0;
    if (wa + em === 0) return [];
    return [
      { name: "WhatsApp", value: wa },
      { name: "Email", value: em },
    ];
  }, [convos.data, emails.data]);

  const isLoading = pipeline.isLoading || convos.isLoading || emails.isLoading;
  const error = pipeline.error || convos.error || emails.error;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        No se pudieron cargar las métricas.
        <Button
          variant="ghost"
          size="sm"
          className="ml-2"
          onClick={() => {
            void pipeline.refetch();
            void convos.refetch();
            void emails.refetch();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const totalContacts = (convos.data?.length ?? 0) + (emails.data?.length ?? 0);
  const noData = stageData.length === 0 && channelData.length === 0 && totalContacts === 0;

  if (noData) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Aún no hay datos suficientes para mostrar métricas.
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* KPI cards. Response-time has no backend query (NOTE), so we show the
          conversation volume + the approximate conversion instead. */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-foreground p-4 text-background">
          <div className="text-[30px] font-bold tracking-tight">{totalContacts}</div>
          <div className="mt-1 text-[13px] text-background/60">Conversaciones activas</div>
        </div>
        <div className="rounded-2xl bg-secondary p-4 text-foreground">
          <div className="text-[30px] font-bold tracking-tight">
            {conversion == null ? "—" : `${conversion}%`}
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">Conversión lead→visita</div>
        </div>
      </div>

      <h3 className="mb-3 text-[16px] font-bold tracking-tight text-foreground">
        Oportunidades por etapa
      </h3>
      {stageData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin pipeline activo.</p>
      ) : (
        <div style={{ height: CHART_HEIGHT }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
              <XAxis dataKey="stage" tick={AXIS_TICK} stroke="var(--border)" />
              <YAxis tick={AXIS_TICK} stroke="var(--border)" allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="count" name="Oportunidades" radius={[6, 6, 0, 0]}>
                {stageData.map((_, i) => (
                  <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="mb-3 mt-6 text-[16px] font-bold tracking-tight text-foreground">
        Mensajes por canal
      </h3>
      {channelData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin conversaciones aún.</p>
      ) : (
        <div style={{ height: CHART_HEIGHT }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={channelData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {channelData.map((_, i) => (
                  <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
