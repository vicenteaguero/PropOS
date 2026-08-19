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
  Inbox,
  MessageCircle,
  Mic,
  Receipt,
  Sparkles,
  StickyNote,
  Users,
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
import { AgentOverlay } from "@features/agent/components/agent-overlay";
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
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TYPE_META: Record<CalendarItem["item_type"], { tone: PillTone; label: string }> = {
  EVENT: { tone: "accent", label: "Evento" },
  TASK: { tone: "warning", label: "Tarea" },
  PAYMENT: { tone: "success", label: "Pago" },
};

function ServiceTile({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[88px] flex-col items-start justify-between rounded-2xl bg-secondary p-3 text-left transition active:scale-[0.97] lg:h-auto lg:flex-row lg:items-center lg:gap-3 lg:p-3.5 lg:hover:bg-muted"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon className="size-[19px] text-foreground" strokeWidth={1.9} />
      </span>
      <span className="text-[13px] font-semibold text-foreground lg:flex-1">{tile.label}</span>
      <ChevronRight className="hidden size-4 text-muted-foreground lg:block" />
    </button>
  );
}

/**
 * KPI text for a counted query. Loading shows an ellipsis and a failure shows a
 * dash, so an outage never renders as a real zero.
 */
function statValue(isPending: boolean, isError: boolean, value: number): string {
  if (isPending) return "…";
  if (isError) return "—";
  return String(value);
}

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
    <div className="flex-1 rounded-2xl bg-secondary px-3.5 py-3">
      <div className="text-2xl font-bold tracking-tight text-foreground">
        {pending ? "…" : value}
      </div>
      <div className="mt-1 truncate text-[12.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** Desktop KPI card — single-line: icon · value · label. */
function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Icon className="size-[18px] text-foreground" strokeWidth={1.8} />
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">{value}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function AdminHomePage() {
  const { user, memberships, switchTenant } = useAuth();
  const agentName = useAgentName();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [wsOpen, setWsOpen] = useState(false);
  const [propoOpen, setPropoOpen] = useState(false);
  const [propoMode, setPropoMode] = useState<"voice" | "chat">("chat");

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
  const recent = (contactsQ.data ?? []).slice(0, isDesktop ? 6 : 4);

  // Pipeline counts for the mobile "Pipeline" pills.
  const oppsQ = useOpportunities({ status: "OPEN", limit: 100 });
  const openOpps = oppsQ.data ?? [];
  const leadsActivos = openOpps.length;
  const enVisita = openOpps.filter((o) => o.pipeline_stage === "VISIT").length;
  // OFFER + RESERVATION are the negotiation-stage opportunities.
  const negociacion = openOpps.filter(
    (o) => o.pipeline_stage === "OFFER" || o.pipeline_stage === "RESERVATION",
  ).length;

  // Today's agenda + KPIs (desktop dashboard only — cheap single-day window).
  const today = new Date();
  const todayFeed = useCalendarFeed(startOfDay(today).toISOString(), endOfDay(today).toISOString());
  const todayItems = (todayFeed.data ?? [])
    .filter((it) => it.start_at)
    .sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  const todayVisits = todayItems.filter((it) => it.item_type === "EVENT").length;
  const todayTasks = todayItems.filter((it) => it.item_type === "TASK").length;
  // Next event drives the mobile "Tu día" card; `[0]` is typed as possibly
  // undefined, so bind it once and gate the card on it (narrows the accesses).
  const nextEvent = todayItems[0];
  const pendingQuery = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    enabled: allow("pendientes"),
  });
  const pendingCount = pendingQuery.data?.pending_count ?? 0;

  const tiles: Tile[] = [
    { to: `${base}/bandeja`, label: "CRM", icon: Users, scope: "crm" },
    { to: `${base}/calendario`, label: "Agenda", icon: CalendarDays, scope: "productividad" },
    { to: `${base}/tareas`, label: "Tareas", icon: CheckSquare, scope: "productividad" },
    { to: `${base}/notas`, label: "Notas", icon: StickyNote, scope: "productividad" },
    { to: `${base}/client-inbox`, label: "WhatsApp", icon: MessageCircle, scope: "inbox" },
    { to: `${base}/documents`, label: "Docs", icon: FileText, scope: "documents" },
    { to: "/admin/properties", label: "Propiedades", icon: Building2, adminOnly: true },
    { to: "/admin/finanzas", label: "Finanzas", icon: Receipt, scope: "finanzas", adminOnly: true },
  ].filter((t) => allow(t.scope) && (!t.adminOnly || isAdmin));

  // Propo ask bar + mic — shared between layouts.
  const propoBar = canPropo && (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={() => {
          setPropoMode("chat");
          setPropoOpen(true);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left transition hover:bg-muted active:scale-[0.99]"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Sparkles className="size-4" />
        </span>
        <span className="truncate text-[15px] font-medium text-muted-foreground">
          Pídele algo a {agentName}…
        </span>
      </button>
      <button
        type="button"
        aria-label={`Hablar con ${agentName}`}
        onClick={() => {
          setPropoMode("voice");
          setPropoOpen(true);
        }}
        className="flex w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background transition active:scale-95"
      >
        <Mic className="size-[21px]" strokeWidth={1.9} />
      </button>
    </div>
  );

  const recentList = (
    <div>
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
        <PageSkeleton variant="list" count={isDesktop ? 6 : 4} />
      ) : recent.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground lg:px-4">
          Aún no hay contactos.
        </p>
      ) : (
        recent.map((c, i) => (
          <Row
            key={c.id}
            onClick={() => navigate(`${base}/personas/${c.id}`)}
            divider={i < recent.length - 1}
            left={
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
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

  // ---- Desktop dashboard ----
  const desktop = (
    <div className="mx-auto w-full max-w-7xl px-8 py-7">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: greeting, Propo, KPIs, Tu día */}
        <section className="flex flex-col gap-6 lg:col-span-2">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-foreground">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>

          {canPropo && <div className="max-w-2xl">{propoBar}</div>}

          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Personas en tu CRM"
              value={statValue(
                contactsQ.isPending,
                contactsQ.isError,
                (contactsQ.data ?? []).length,
              )}
              icon={Users}
            />
            <Kpi
              label="Eventos hoy"
              value={statValue(todayFeed.isPending, todayFeed.isError, todayItems.length)}
              icon={CalendarDays}
            />
            {allow("pendientes") && (
              <Kpi
                label="Pendientes por revisar"
                value={statValue(pendingQuery.isPending, pendingQuery.isError, pendingCount)}
                icon={Inbox}
              />
            )}
          </div>

          {/* Tu día */}
          <div>
            <SectionLabel action="Ver calendario" onAction={() => navigate(`${base}/calendario`)}>
              Tu día · {format(today, "EEEE d 'de' MMMM", { locale: es })}
            </SectionLabel>
            <div className="mt-2 rounded-2xl border border-border">
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
              ) : todayItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <CalendarDays className="size-9 text-faint" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">Nada agendado para hoy.</p>
                </div>
              ) : (
                todayItems.map((it, i) => {
                  const meta = TYPE_META[it.item_type];
                  return (
                    <Row
                      key={`${it.item_type}-${it.id}`}
                      divider={i < todayItems.length - 1}
                      left={
                        <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-muted-foreground">
                          {it.all_day || !it.start_at
                            ? "Todo"
                            : format(new Date(it.start_at), "HH:mm")}
                        </span>
                      }
                      title={it.title ?? "Sin título"}
                      right={<Pill tone={meta.tone}>{meta.label}</Pill>}
                    />
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right column: quick access, then recent people */}
        <section className="flex flex-col gap-6">
          <div>
            <SectionLabel>Accesos rápidos</SectionLabel>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {tiles.map((t) => (
                <ServiceTile key={t.to} tile={t} onClick={() => navigate(t.to)} />
              ))}
            </div>
          </div>

          {allow("crm") && (
            <div>
              <SectionLabel action="Ver CRM" onAction={() => navigate(`${base}/personas`)}>
                Personas recientes
              </SectionLabel>
              <div className="mt-2 rounded-2xl border border-border">{recentList}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  // ---- Mobile home ----
  const mobile = (
    <div className="mx-auto w-full max-w-2xl pb-6">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
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

      <h1 className="px-5 text-[25px] font-bold leading-tight tracking-tight text-foreground">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}
      </h1>

      {canPropo && <div className="px-5 pt-4 pb-5">{propoBar}</div>}

      <div className="grid grid-cols-4 gap-2.5 px-5 pb-6">
        {tiles.map((t) => (
          <button
            key={t.to}
            type="button"
            onClick={() => navigate(t.to)}
            className="flex h-[88px] flex-col items-start justify-between rounded-2xl bg-secondary p-3 text-left transition active:scale-[0.97]"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-background shadow-sm">
              <t.icon className="size-[19px] text-foreground" strokeWidth={1.9} />
            </span>
            <span className="text-[12.5px] font-semibold leading-tight text-foreground">
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tu día — next event */}
      {nextEvent && (
        <div className="px-5 pb-6">
          <div className="overflow-hidden rounded-3xl bg-foreground text-background">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
              <span className="text-[12.5px] font-bold uppercase tracking-wide opacity-60">
                Tu día
              </span>
              <span className="text-[12.5px] font-semibold opacity-80">
                {todayVisits} {todayVisits === 1 ? "visita" : "visitas"} · {todayTasks}{" "}
                {todayTasks === 1 ? "tarea" : "tareas"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${base}/calendario`)}
              className="flex w-full items-center gap-3 border-t border-white/10 p-4 text-left transition active:scale-[0.99]"
            >
              <span className="min-w-[54px] rounded-xl bg-background px-2.5 py-1.5 text-center text-foreground">
                <span className="block text-[15px] font-bold leading-none">
                  {nextEvent.all_day || !nextEvent.start_at
                    ? "Todo"
                    : format(new Date(nextEvent.start_at as string), "HH:mm")}
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
                  hoy
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">
                  {nextEvent.title ?? "Sin título"}
                </span>
                <span className="mt-0.5 block text-[13px] opacity-60">
                  Próximo · {TYPE_META[nextEvent.item_type].label}
                </span>
              </span>
              <ChevronRight className="size-[18px] shrink-0 opacity-50" />
            </button>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <SectionLabel action="Ver CRM" onAction={() => navigate(`${base}/bandeja`)}>
        Pipeline
      </SectionLabel>
      {oppsQ.isError ? (
        <div className="px-5 pt-2 pb-6">
          <ErrorState
            compact
            message="No se pudo cargar el pipeline."
            error={oppsQ.error}
            onRetry={() => oppsQ.refetch()}
          />
        </div>
      ) : (
        <div className="flex gap-2 px-5 pt-2 pb-6">
          <PipelineStat value={leadsActivos} label="Leads activos" pending={oppsQ.isPending} />
          <PipelineStat value={enVisita} label="En visita" pending={oppsQ.isPending} />
          <PipelineStat value={negociacion} label="Negociación" pending={oppsQ.isPending} />
        </div>
      )}

      {allow("crm") && (
        <>
          <SectionLabel action="Ver CRM" onAction={() => navigate(`${base}/personas`)}>
            Personas recientes
          </SectionLabel>
          <div className="mt-2">{recentList}</div>
        </>
      )}
    </div>
  );

  return (
    <>
      {isDesktop ? desktop : mobile}

      {/* Workspace switcher */}
      <BottomSheet
        open={wsOpen}
        onOpenChange={setWsOpen}
        title="Espacio de trabajo"
        description="Cada empresa trabaja sin mezclar información."
      >
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
                  "mb-2 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]",
                  active ? "border-foreground" : "border-border",
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `hsl(${hueForTenant(m.tenantId)} 42% 55%)` }}
                >
                  <Building2 className="size-5 text-white" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold tracking-tight text-foreground">
                    {m.tenantName ?? m.tenantSlug ?? m.tenantId}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {m.role.toLowerCase()}
                  </span>
                </span>
                {active && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-foreground">
                    <Check className="size-3.5 text-background" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {canPropo && propoOpen && (
        <AgentOverlay onClose={() => setPropoOpen(false)} initialMode={propoMode} />
      )}
    </>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AdminHomePage;
