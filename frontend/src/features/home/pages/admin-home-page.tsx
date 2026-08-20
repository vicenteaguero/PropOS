import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  FileText,
  MessageCircle,
  Mic,
  Receipt,
  Sparkles,
  StickyNote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { startOfDay, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { hueForTenant } from "@core/theme/tenant-accent";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { useCalendarFeed } from "@features/calendar/hooks/use-calendar";
import type { CalendarItem } from "@features/calendar/api/calendar-api";
import { apiRequest } from "@shared/api/http";
import { UfButton } from "@features/uf/components/uf-button";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import {
  BottomSheet,
  ErrorState,
  PageSkeleton,
  Pill,
  Row,
  SectionLabel,
  TOUCH_TARGET_HIT_AREA,
  WorkspacePill,
  type PillTone,
} from "@shared/ui";
import { cn } from "@/lib/utils";
import { initials } from "@shared/utils/format";

interface Tile {
  to: string;
  label: string;
  icon: LucideIcon;
  scope?: string;
  /** routes that only exist for the ADMIN role */
  adminOnly?: boolean;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

const TYPE_META: Record<CalendarItem["item_type"], { tone: PillTone; label: string }> = {
  EVENT: { tone: "accent", label: "Evento" },
  TASK: { tone: "warning", label: "Tarea" },
  PAYMENT: { tone: "success", label: "Pago" },
};

/** Mobile pipeline tile — one stage count. */
function PipelineStat({
  value,
  label,
  pending,
}: {
  value: number;
  label: string;
  pending: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl bg-secondary px-3.5 py-3">
      <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
        {pending ? "…" : value}
      </div>
      <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function AdminHomePage() {
  const { user, memberships, switchTenant } = useAuth();
  const agentName = useAgentName();
  const navigate = useNavigate();
  const propo = useAgentOverlay();
  const [wsOpen, setWsOpen] = useState(false);

  const role = (user?.role ?? "ADMIN").toLowerCase();
  const base = `/${role}`;
  const isAdmin = role === "admin";
  const firstName = (user?.fullName ?? "").split(" ")[0] || "";
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdmin && allow("agent");
  const tenantName =
    memberships.find((m) => m.tenantId === user?.tenantId)?.tenantName ?? "Workspace";

  const contactsQ = useContacts({ limit: 50 });
  const recent = (contactsQ.data ?? []).slice(0, 6);

  const oppsQ = useOpportunities({ status: "OPEN", limit: 100 });
  const openOpps = oppsQ.data ?? [];
  const leadsActivos = openOpps.length;
  const enVisita = openOpps.filter((o) => o.pipeline_stage === "VISIT").length;
  // OFFER + RESERVATION are the negotiation-stage opportunities.
  const negociacion = openOpps.filter(
    (o) => o.pipeline_stage === "OFFER" || o.pipeline_stage === "RESERVATION",
  ).length;

  const today = new Date();
  const todayFeed = useCalendarFeed(startOfDay(today).toISOString(), endOfDay(today).toISOString());
  const todayItems = (todayFeed.data ?? [])
    .filter((it) => it.start_at)
    .sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  // A section that would render only zeros is not information, it is noise
  // wearing the costume of information. Each of these gates a whole block.
  const hasPipeline = leadsActivos + enVisita + negociacion > 0;
  const hasRecent = recent.length > 0;

  // The agenda widget distinguishes "nothing today" from "today is already
  // behind you" — a broker at 19:00 with three finished visits should not be
  // shown a stale 09:00 appointment as if it were next.
  const nowIso = new Date().toISOString();
  const upcoming = todayItems.filter((it) => (it.start_at ?? "") >= nowIso);
  const nextItem = upcoming[0];

  const pendingQuery = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    enabled: allow("pendientes"),
  });
  const pendingCount = pendingQuery.data?.pending_count ?? 0;

  const tiles: Tile[] = [
    // CRM and Agenda are deliberately absent: both are permanent bottom-nav
    // tabs, so repeating them here spends grid on destinations already one tap
    // away.
    { to: `${base}/tareas`, label: "Tareas", icon: CheckSquare, scope: "productividad" },
    { to: `${base}/notas`, label: "Notas", icon: StickyNote, scope: "productividad" },
    { to: `${base}/client-inbox`, label: "WhatsApp", icon: MessageCircle, scope: "inbox" },
    { to: `${base}/documents`, label: "Docs", icon: FileText, scope: "documents" },
    { to: "/admin/properties", label: "Propiedades", icon: Building2, adminOnly: true },
    { to: "/admin/finanzas", label: "Finanzas", icon: Receipt, scope: "finanzas", adminOnly: true },
  ].filter((t) => allow(t.scope) && (!t.adminOnly || isAdmin));

  const propoBar = canPropo && (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => propo.open("chat")}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-secondary px-3.5 py-3 text-left transition hover:bg-muted active:scale-[0.99]"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Sparkles className="size-4" />
        </span>
        <span className="truncate text-[15px] text-muted-foreground">
          Pídele algo a {agentName}…
        </span>
      </button>
      <button
        type="button"
        aria-label={`Hablar con ${agentName}`}
        onClick={() => propo.open("voice")}
        className="flex w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition active:scale-95"
      >
        <Mic className="size-[21px]" strokeWidth={1.9} />
      </button>
    </div>
  );

  /**
   * Agenda widget. One row, three states, never a wall of copy: what is next,
   * or that the day is done, or that it is empty plus the way to fill it.
   */
  const agendaWidget = (
    <button
      type="button"
      onClick={() => navigate(`${base}/calendario`)}
      className="flex w-full items-center gap-3 rounded-xl bg-foreground px-3.5 py-3 text-left text-background transition active:scale-[0.99]"
    >
      {nextItem ? (
        <>
          <span className="min-w-[52px] rounded-lg bg-background px-2 py-1.5 text-center text-foreground">
            <span className="block text-[15px] font-bold leading-none tabular-nums">
              {nextItem.all_day || !nextItem.start_at
                ? "Todo"
                : format(new Date(nextItem.start_at), "HH:mm")}
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground">
              {TYPE_META[nextItem.item_type].label.toLowerCase()}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">
              {nextItem.title ?? "Sin título"}
            </span>
            <span className="mt-0.5 block text-[12.5px] opacity-60">
              {upcoming.length > 1 ? `+${upcoming.length - 1} más hoy` : "Último de hoy"}
            </span>
          </span>
        </>
      ) : (
        <>
          <CalendarDays className="size-[18px] shrink-0 opacity-70" strokeWidth={1.9} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {todayItems.length > 0
              ? `Día cerrado · ${todayItems.length} ${todayItems.length === 1 ? "evento" : "eventos"}`
              : "Nada agendado hoy"}
          </span>
        </>
      )}
      <ChevronRight className="size-[18px] shrink-0 opacity-50" />
    </button>
  );

  const recentList = (
    <div className="rounded-xl border border-border">
      {contactsQ.isError ? (
        <div className="p-4">
          <ErrorState
            compact
            message="No se pudieron cargar las personas."
            error={contactsQ.error}
            onRetry={() => contactsQ.refetch()}
          />
        </div>
      ) : contactsQ.isPending ? (
        <PageSkeleton variant="list" count={4} />
      ) : (
        recent.map((c, i) => (
          <Row
            key={c.id}
            onClick={() => navigate(`${base}/personas/${c.id}`)}
            divider={i < recent.length - 1}
            left={
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                {initials(c.full_name)}
              </span>
            }
            title={c.full_name}
            sub={[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
          />
        ))
      )}
    </div>
  );

  const todayList = (
    <div className="rounded-xl border border-border">
      {todayFeed.isError ? (
        <div className="p-4">
          <ErrorState
            compact
            message="No se pudo cargar tu agenda de hoy."
            error={todayFeed.error}
            onRetry={() => todayFeed.refetch()}
          />
        </div>
      ) : todayFeed.isPending ? (
        <PageSkeleton variant="list" count={3} />
      ) : (
        todayItems.map((it, i) => {
          const meta = TYPE_META[it.item_type];
          return (
            <Row
              key={`${it.item_type}-${it.id}`}
              divider={i < todayItems.length - 1}
              left={
                <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-muted-foreground">
                  {it.all_day || !it.start_at ? "Todo" : format(new Date(it.start_at), "HH:mm")}
                </span>
              }
              title={it.title ?? "Sin título"}
              right={<Pill tone={meta.tone}>{meta.label}</Pill>}
            />
          );
        })
      )}
    </div>
  );

  return (
    <>
      {/* One tree for every width. The gutter lives on the container, not on
          each section, which is what let paddings drift apart before. */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-[var(--page-x)] pt-4 pb-8 lg:max-w-6xl lg:pt-6">
        {/* The desktop shell already carries workspace, UF and the bell in its
            header, so this row is the phone shell's stand-in for it. */}
        <div className="flex items-center justify-between md:hidden">
          <WorkspacePill label={tenantName} onClick={() => setWsOpen(true)} />
          <div className="flex items-center gap-2">
            <UfButton />
            {allow("pendientes") && (
              <button
                type="button"
                aria-label={pendingCount > 0 ? `Pendientes (${pendingCount})` : "Pendientes"}
                onClick={() => navigate(`${base}/pendientes`)}
                className={`relative flex size-10 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90 ${TOUCH_TARGET_HIT_AREA}`}
              >
                <Bell className="size-[18px]" strokeWidth={1.9} />
                {pendingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-[18px] text-destructive-foreground">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground lg:text-[26px]">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
            {format(today, "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {agendaWidget}
        {propoBar}

        {/* auto-fill instead of a fixed column count: three tiles on a phone,
            as many as fit on a tablet or a wide window, with no breakpoint to
            keep in sync with the tile list. */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
          {tiles.map((t) => (
            <button
              key={t.to}
              type="button"
              onClick={() => navigate(t.to)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl bg-secondary px-2 py-3.5 transition hover:bg-muted active:scale-[0.97]"
            >
              <t.icon className="size-[22px] text-foreground" strokeWidth={1.8} />
              <span className="w-full truncate text-center text-[12px] font-medium text-foreground">
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {(hasPipeline || oppsQ.isError) &&
          (oppsQ.isError ? (
            <ErrorState
              compact
              message="No se pudo cargar el pipeline."
              error={oppsQ.error}
              onRetry={() => oppsQ.refetch()}
            />
          ) : (
            <div className="flex gap-2">
              <PipelineStat value={leadsActivos} label="Leads activos" pending={oppsQ.isPending} />
              <PipelineStat value={enVisita} label="En visita" pending={oppsQ.isPending} />
              <PipelineStat value={negociacion} label="Negociación" pending={oppsQ.isPending} />
            </div>
          ))}

        {/* Below the fold the two lists sit side by side once there is room.
            Same markup either way — only the grid changes. */}
        <div className="grid gap-4 lg:grid-cols-2">
          {todayItems.length > 0 || todayFeed.isPending || todayFeed.isError ? (
            <section className="flex flex-col gap-2">
              <SectionLabel action="Ver agenda" onAction={() => navigate(`${base}/calendario`)}>
                Hoy
              </SectionLabel>
              {todayList}
            </section>
          ) : null}

          {allow("crm") && (hasRecent || contactsQ.isPending || contactsQ.isError) && (
            <section className="flex flex-col gap-2">
              <SectionLabel action="Ver todas" onAction={() => navigate(`${base}/personas`)}>
                Personas
              </SectionLabel>
              {recentList}
            </section>
          )}
        </div>
      </div>

      <BottomSheet open={wsOpen} onOpenChange={setWsOpen} title="Espacio de trabajo">
        <div className="mt-3">
          {memberships.map((m) => {
            const active = m.tenantId === user?.tenantId;
            return (
              <button
                key={m.tenantId}
                type="button"
                onClick={() => {
                  if (!active) void switchTenant(m.tenantId);
                  setWsOpen(false);
                }}
                className={cn(
                  "mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99]",
                  active ? "border-foreground" : "border-border",
                )}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `hsl(${hueForTenant(m.tenantId)} 42% 55%)` }}
                >
                  <Building2 className="size-4 text-white" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold tracking-tight text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {m.role.toLowerCase()}
                  </span>
                </span>
                {active && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3 text-background" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AdminHomePage;
