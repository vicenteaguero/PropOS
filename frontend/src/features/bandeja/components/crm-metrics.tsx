import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { apiRequest } from "@shared/api/http";
import { useConversations } from "@features/client-chat/hooks/use-client-chat";
import { useEmailThreads } from "@features/email/hooks/use-email";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { STAGE_LABELS } from "@features/opportunities/types";
import { ErrorState, PageSkeleton } from "@shared/ui";
import {
  AXIS_TICK,
  CHART_HEIGHT,
  STAGE_COLORS,
  STAGE_ORDER,
  TOOLTIP_STYLE,
} from "@shared/lib/chart-config";

interface PipelineRow {
  pipeline_stage: string;
  opp_count: number;
  expected_value_cents: number;
}

/** Only the fields the sale/rent split needs off `GET /v1/properties`. */
interface PropertyListingRow {
  id: string;
  listing_kind: string;
}

/** Backend cap for both lists; the split degrades honestly past it. */
const PAGE_LIMIT = 500;

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

// WhatsApp / Email channel accents for the donut. CSS vars only (no raw hex).
const CHANNEL_COLORS = ["var(--chart-1)", "var(--chart-3)"];

/**
 * Métricas tab. Reuses the existing analytics `/pipeline` endpoint for the
 * stage bar chart, and the bandeja data hooks (conversations + email threads)
 * for the channel split donut — both real data, nothing fabricated.
 *
 * NOTE: the mockup also shows "tiempo de respuesta promedio" and
 * "conversión lead→visita" KPIs. There is no backend query for response time,
 * and conversion is approximated from open-pipeline stage counts (no historical
 * funnel hook is exposed here). Rendered only what is available.
 *
 * The sale/rent split is NOT in `v_pipeline_status` (it groups by stage only),
 * so it is joined here: open opportunities → their property → `listing_kind`.
 * Opportunities whose property is missing or beyond the page limit are reported
 * as unclassified instead of being silently dropped into one side.
 */
export function CrmMetrics() {
  const pipeline = useQuery({
    queryKey: ["analytics", "pipeline"],
    queryFn: () => apiRequest<PipelineRow[]>("/v1/analytics/pipeline"),
  });
  const convos = useConversations();
  const emails = useEmailThreads({});
  // Same params as CrmPipeline, so both tabs share one cached response.
  const opportunities = useOpportunities({ status: "OPEN", limit: PAGE_LIMIT });
  const properties = useQuery({
    queryKey: ["properties", "listing-kinds", PAGE_LIMIT],
    queryFn: () => apiRequest<PropertyListingRow[]>(`/v1/properties?limit=${PAGE_LIMIT}`),
    staleTime: 300_000,
  });

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

  // Sale vs rent over the open pipeline. LEASE folds into "arriendo" — the
  // Chilean term covers both.
  const operation = useMemo(() => {
    const kindById = new Map<string, string>();
    for (const p of properties.data ?? []) kindById.set(p.id, p.listing_kind);
    let sale = 0;
    let rent = 0;
    let unknown = 0;
    for (const opp of opportunities.data ?? []) {
      const kind = opp.property_id ? kindById.get(opp.property_id) : undefined;
      if (kind === "SALE") sale += 1;
      else if (kind === "RENT" || kind === "LEASE") rent += 1;
      else unknown += 1;
    }
    return { sale, rent, unknown, classified: sale + rent };
  }, [opportunities.data, properties.data]);

  const isLoading =
    pipeline.isLoading ||
    convos.isLoading ||
    emails.isLoading ||
    opportunities.isLoading ||
    properties.isLoading;
  const error =
    pipeline.error || convos.error || emails.error || opportunities.error || properties.error;

  if (isLoading) {
    return <PageSkeleton variant="detail" className="pt-4" />;
  }

  if (error) {
    return (
      <ErrorState
        message="No se pudieron cargar las métricas."
        onRetry={() => {
          void pipeline.refetch();
          void convos.refetch();
          void emails.refetch();
          void opportunities.refetch();
          void properties.refetch();
        }}
      />
    );
  }

  const totalContacts = (convos.data?.length ?? 0) + (emails.data?.length ?? 0);
  const noData =
    stageData.length === 0 &&
    channelData.length === 0 &&
    totalContacts === 0 &&
    operation.classified === 0;

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
        <div className="rounded-xl bg-foreground p-4 text-background">
          <div className="text-[30px] font-bold tracking-tight">{totalContacts}</div>
          <div className="mt-1 text-[13px] text-background/60">Conversaciones activas</div>
        </div>
        <div className="rounded-xl bg-secondary p-4 text-foreground">
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

      {/* Sale vs rent. Two numbers, so tiles rather than a chart: the palette is
          accent + neutrals, and a two-hue split would not separate reliably. */}
      <h3 className="mb-1 mt-6 text-[16px] font-bold tracking-tight text-foreground">
        Pipeline por operación
      </h3>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        Oportunidades abiertas según el tipo de operación de la propiedad vinculada.
      </p>
      {operation.classified === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ninguna oportunidad abierta tiene una propiedad vinculada.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-secondary p-4 text-foreground">
              <div className="text-[30px] font-bold tracking-tight">{operation.sale}</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Venta · {pct(operation.sale, operation.classified)}%
              </div>
            </div>
            <div className="rounded-xl bg-secondary p-4 text-foreground">
              <div className="text-[30px] font-bold tracking-tight">{operation.rent}</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Arriendo · {pct(operation.rent, operation.classified)}%
              </div>
            </div>
          </div>
          {operation.unknown > 0 && (
            <p className="mt-2 text-[12px] text-faint">
              {operation.unknown} {operation.unknown === 1 ? "oportunidad" : "oportunidades"} sin
              operación identificada.
            </p>
          )}
        </>
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
