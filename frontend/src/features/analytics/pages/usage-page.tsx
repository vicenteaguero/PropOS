import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@shared/api/http";
import { ChartCard, ErrorState, PageSkeleton, Segmented, StatCard } from "@shared/ui";

interface UsageDay {
  user_id: string;
  full_name: string | null;
  email: string | null;
  day: string;
  page_views: number;
  actions: number;
  active_minutes: number;
  first_seen: string | null;
  last_seen: string | null;
}

interface UsageKey {
  key: string;
  kind: "page_view" | "action" | "session_ping";
  count: number;
}

interface UsageCost {
  window_days: number;
  floor_hours_per_day: number;
  cpu_usd: number;
  memory_usd: number;
  total_usd: number;
  projected_monthly_usd: number;
}

interface UsageSummary {
  days: UsageDay[];
  top_keys: UsageKey[];
  cost: UsageCost;
}

const RANGES = [
  { id: "7", label: "7 días" },
  { id: "14", label: "14 días" },
  { id: "30", label: "30 días" },
];

const USD = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD" });

function personName(row: UsageDay): string {
  return row.full_name || row.email || row.user_id.slice(0, 8);
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function timeOfDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

/**
 * What people did in the app, as opposed to what the servers did.
 *
 * Deliberately not a line chart of requests per minute: that is the number Cloud
 * Monitoring already draws, and it answers a question nobody here is asking. The
 * questions are "who opened the app", "for how long", and "which screens did
 * they actually reach" -- so the page leads with minutes of attention, per
 * person, and ranks screens by how often they were opened.
 */
export function UsagePage() {
  const [days, setDays] = useState("14");

  const query = useQuery<UsageSummary>({
    queryKey: ["usage", "summary", days],
    queryFn: () => apiRequest(`/v1/usage/summary?days=${days}`),
    staleTime: 60_000,
  });

  const byPerson = useMemo(() => {
    const rows = query.data?.days ?? [];
    const acc = new Map<
      string,
      { name: string; minutes: number; views: number; actions: number }
    >();
    for (const r of rows) {
      const cur = acc.get(r.user_id) ?? { name: personName(r), minutes: 0, views: 0, actions: 0 };
      cur.minutes += r.active_minutes;
      cur.views += r.page_views;
      cur.actions += r.actions;
      acc.set(r.user_id, cur);
    }
    return [...acc.values()].sort((a, b) => b.minutes - a.minutes);
  }, [query.data]);

  if (query.isLoading) return <PageSkeleton variant="list" />;
  if (query.error) {
    return <ErrorState message="No pudimos cargar el uso." onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const totals = (data?.days ?? []).reduce(
    (acc, r) => ({
      minutes: acc.minutes + r.active_minutes,
      views: acc.views + r.page_views,
      actions: acc.actions + r.actions,
    }),
    { minutes: 0, views: 0, actions: 0 },
  );

  const screens = (data?.top_keys ?? []).filter((k) => k.kind === "page_view");
  const actions = (data?.top_keys ?? []).filter((k) => k.kind === "action");

  return (
    <div className="flex flex-col gap-5">
      <Segmented items={RANGES} value={days} onChange={setDays} variant="pill" gutter={false} />

      {totals.minutes === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no hay actividad registrada en este período.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Minutos activos" value={formatMinutes(totals.minutes)} tone="ink" />
        <StatCard label="Pantallas abiertas" value={String(totals.views)} />
        <StatCard label="Acciones" value={String(totals.actions)} />
        <StatCard
          label={`Costo Cloud Run (${data?.cost.window_days ?? 0} d)`}
          value={USD.format(data?.cost.total_usd ?? 0)}
        />
      </div>

      {/* The number the scaling schedule exists to control, stated plainly rather
          than buried in a billing console. */}
      <p className="text-xs text-muted-foreground">
        Piso de instancia encendido {data?.cost.floor_hours_per_day ?? 0} h al día ·{" "}
        {USD.format(data?.cost.projected_monthly_usd ?? 0)} al mes proyectado (CPU{" "}
        {USD.format(data?.cost.cpu_usd ?? 0)} + memoria {USD.format(data?.cost.memory_usd ?? 0)} en
        el período). No incluye cómputo por request ni Supabase.
      </p>

      <ChartCard title="Por persona">
        <div className="flex flex-col gap-3">
          {byPerson.length === 0 && <EmptyRow />}
          {byPerson.map((p) => (
            <Meter
              key={p.name}
              label={p.name}
              value={p.minutes}
              max={byPerson[0]?.minutes || 1}
              display={formatMinutes(p.minutes)}
              caption={`${p.views} pantallas · ${p.actions} acciones`}
            />
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Pantallas más abiertas">
        <div className="flex flex-col gap-3">
          {screens.length === 0 && <EmptyRow />}
          {screens.map((k) => (
            <Meter
              key={k.key}
              label={k.key}
              value={k.count}
              max={screens[0]?.count || 1}
              display={String(k.count)}
              mono
            />
          ))}
        </div>
      </ChartCard>

      {actions.length > 0 && (
        <ChartCard title="Acciones">
          <div className="flex flex-col gap-3">
            {actions.map((k) => (
              <Meter
                key={k.key}
                label={k.key}
                value={k.count}
                max={actions[0]?.count || 1}
                display={String(k.count)}
                mono
              />
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard title="Día a día">
        {/* The table IS the accessible view of everything above: same numbers,
            no color carrying meaning. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-4 font-medium">Día</th>
                <th className="py-1 pr-4 font-medium">Persona</th>
                <th className="py-1 pr-4 text-right font-medium">Minutos</th>
                <th className="py-1 pr-4 text-right font-medium">Pantallas</th>
                <th className="py-1 pr-4 text-right font-medium">Acciones</th>
                <th className="py-1 pr-4 font-medium">Desde</th>
                <th className="py-1 font-medium">Hasta</th>
              </tr>
            </thead>
            <tbody>
              {(data?.days ?? []).map((r) => (
                <tr key={`${r.day}-${r.user_id}`} className="border-t border-border/60">
                  <td className="py-1.5 pr-4 tabular-nums">{r.day}</td>
                  <td className="py-1.5 pr-4">{personName(r)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{r.active_minutes}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{r.page_views}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{r.actions}</td>
                  <td className="py-1.5 pr-4 tabular-nums">{timeOfDay(r.first_seen)}</td>
                  <td className="py-1.5 tabular-nums">{timeOfDay(r.last_seen)}</td>
                </tr>
              ))}
              {(data?.days ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-muted-foreground">
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function EmptyRow() {
  return <p className="text-sm text-muted-foreground">Sin datos.</p>;
}

/**
 * A ranked magnitude row: label, value, and a bar for the comparison.
 *
 * One measure, one hue -- so no legend and no categorical palette. The bar is
 * scaled against the largest row rather than against a round number, because the
 * question is "which of these is biggest", not "how close to a target".
 */
function Meter({
  label,
  value,
  max,
  display,
  caption,
  mono,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  caption?: string;
  mono?: boolean;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={mono ? "truncate font-mono text-xs" : "truncate text-sm font-medium"}>
          {label}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{display}</span>
      </div>
      {/* Thin mark on a recessive track, rounded at the data end only -- the bar
          grows from a fixed baseline, so a rounded start would fake a gap. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-r-full bg-accent-brand"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
      {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
    </div>
  );
}
