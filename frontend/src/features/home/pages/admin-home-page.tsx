import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  FileText,
  Inbox,
  MessageCircle,
  Mic,
  Phone,
  Receipt,
  Sparkles,
  StickyNote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { startOfDay, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import type { Contact } from "@features/contacts/types";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { useCalendarFeed } from "@features/calendar/hooks/use-calendar";
import type { CalendarItem } from "@features/calendar/api/calendar-api";
import { interactionsApi } from "@features/interactions/api/interactions-api";
import { INTERACTION_KIND_LABELS } from "@features/interactions/types";
import { apiRequest } from "@shared/api/http";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import {
  ErrorState,
  PageSkeleton,
  Pill,
  SectionLabel,
  WhatsAppMark,
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

/**
 * Every card on this page pads its own content by exactly one --page-x, so
 * there are two vertical edges on the screen and not four: the container gutter
 * (headings, section labels) and container + card (everything inside a card).
 * Before this, tiles sat at 24px, widgets at 30px and list rows at 37px, all
 * within one 16px column.
 */
const CARD_X = "px-[var(--page-x)]";

function timeLabel(item: Pick<CalendarItem, "all_day" | "start_at">): string {
  return item.all_day || !item.start_at ? "Todo" : format(new Date(item.start_at), "HH:mm");
}

export function AdminHomePage() {
  const { user } = useAuth();
  const agentName = useAgentName();
  const navigate = useNavigate();
  const propo = useAgentOverlay();

  const role = (user?.role ?? "ADMIN").toLowerCase();
  const base = `/${role}`;
  const isAdmin = role === "admin";
  const firstName = (user?.fullName ?? "").split(" ")[0] || "";
  const scope = user?.adminScope ?? [];
  const allow = (s?: string) => !s || scope.length === 0 || scope.includes(s);
  // Propo (agent pipeline) is backend ADMIN-only.
  const canPropo = isAdmin && allow("agent");

  const contactsQ = useContacts({ limit: 50 });

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

  // The agenda widget distinguishes "nothing today" from "today is already
  // behind you" — a broker at 19:00 with three finished visits should not be
  // shown a stale 09:00 appointment as if it were next.
  const nowIso = new Date().toISOString();
  const upcoming = todayItems.filter((it) => (it.start_at ?? "") >= nowIso);
  // Three, hard. The old "Hoy" list rendered the whole feed, so on a busy day it
  // pushed everything else off the screen to show what the agenda page shows
  // better. The home screen answers "what is next", not "what is today".
  const nextThree = upcoming.slice(0, 3);
  const [nextItem, ...restOfNext] = nextThree;

  const pendingQuery = useQuery<{ pending_count: number }>({
    queryKey: ["analytics", "pending-count"],
    queryFn: () => apiRequest("/v1/analytics/pending-count"),
    staleTime: 30_000,
    enabled: allow("pendientes"),
  });
  const pendingCount = pendingQuery.data?.pending_count ?? 0;

  const activityQ = useQuery({
    queryKey: ["interactions", "list", { limit: 6 }],
    queryFn: () => interactionsApi.list({ limit: 6 }),
    staleTime: 60_000,
    enabled: allow("crm"),
  });
  const activity = activityQ.data ?? [];

  const tiles: Tile[] = [
    // CRM and Agenda are deliberately absent: both are permanent bottom-nav
    // tabs, so repeating them here spends grid on destinations already one tap
    // away.
    { to: `${base}/agenda?tab=tareas`, label: "Tareas", icon: CheckSquare, scope: "productividad" },
    { to: `${base}/agenda?tab=notas`, label: "Notas", icon: StickyNote, scope: "productividad" },
    { to: `${base}/crm?tab=whatsapp`, label: "WhatsApp", icon: MessageCircle, scope: "inbox" },
    { to: `${base}/documentos`, label: "Docs", icon: FileText, scope: "documents" },
    { to: "/admin/crm?tab=propiedades", label: "Propiedades", icon: Building2, adminOnly: true },
    { to: "/admin/finanzas", label: "Finanzas", icon: Receipt, scope: "finanzas", adminOnly: true },
  ].filter((t) => allow(t.scope) && (!t.adminOnly || isAdmin));

  const propoBar = canPropo && (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => propo.open("chat")}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-secondary py-3 text-left transition hover:bg-muted active:scale-[0.99]",
          CARD_X,
        )}
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
   * Agenda widget. The one block the broker asked to keep, so the ink surface,
   * the time chip and the three states are unchanged — what it gained is the
   * next two items folded in underneath, which is what retired the separate
   * unbounded "Hoy" list.
   */
  const agendaWidget = (
    <div className="overflow-hidden rounded-xl bg-foreground text-background">
      <button
        type="button"
        onClick={() => navigate(`${base}/agenda`)}
        className={cn("flex w-full items-center gap-3 py-3 text-left", CARD_X)}
      >
        {nextItem ? (
          <>
            <span className="min-w-[52px] rounded-lg bg-background px-2 py-1.5 text-center text-foreground">
              <span className="block text-[15px] font-bold leading-none tabular-nums">
                {timeLabel(nextItem)}
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
                {upcoming.length > 1 ? "Lo que viene hoy" : "Último de hoy"}
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

      {restOfNext.map((it) => (
        <button
          key={`${it.item_type}-${it.id}`}
          type="button"
          onClick={() => navigate(`${base}/agenda`)}
          className={cn(
            "flex w-full items-center gap-3 border-t border-background/15 py-2.5 text-left",
            CARD_X,
          )}
        >
          <span className="w-[52px] shrink-0 text-center text-[13px] font-semibold tabular-nums opacity-70">
            {timeLabel(it)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px]">{it.title ?? "Sin título"}</span>
        </button>
      ))}

      {upcoming.length > nextThree.length && (
        <button
          type="button"
          onClick={() => navigate(`${base}/agenda`)}
          className={cn(
            "flex w-full items-center justify-between border-t border-background/15 py-2 text-[12.5px] font-semibold opacity-70",
            CARD_X,
          )}
        >
          <span>+{upcoming.length - nextThree.length} más hoy</span>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );

  /**
   * Pipeline. Its own surface on purpose: it used to be `bg-secondary`, the same
   * token as the tiles above it and the Propo bar below it, so three unrelated
   * blocks painted one continuous grey band and the numbers read as more tiles.
   * Outlined instead of filled, with the counts on the tenant accent.
   */
  const pipelineStrip = (
    <button
      type="button"
      onClick={() => navigate(`${base}/crm?tab=oportunidades`)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background py-3 text-left transition hover:border-primary/40",
        CARD_X,
      )}
    >
      {[
        { value: leadsActivos, label: "Leads activos" },
        { value: enVisita, label: "En visita" },
        { value: negociacion, label: "Negociación" },
      ].map((stat) => (
        <span key={stat.label} className="min-w-0 flex-1">
          <span className="block text-2xl font-bold leading-none tracking-tight tabular-nums text-primary">
            {oppsQ.isPending ? "…" : stat.value}
          </span>
          <span className="mt-1 block truncate text-[12.5px] text-muted-foreground">
            {stat.label}
          </span>
        </span>
      ))}
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
    </button>
  );

  /**
   * Personas. No longer a read-only list — the broker's reason to look at a
   * person from the home screen is to contact them, so the row IS the action:
   * name opens the record, the two buttons dial or open WhatsApp.
   *
   * Recency rule, deliberately simple: `updated_at` desc. Every write that
   * matters (a call logged, a note, an edit, an import match) stamps it, so it
   * tracks "who I have been dealing with" without a second request. People with
   * no phone are filtered out — neither action would work for them.
   */
  const quickPeople: Contact[] = (contactsQ.data ?? [])
    .filter((c) => !!c.phone)
    .slice()
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
    .slice(0, 4);

  const peopleWidget = (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionLabel action="Ver todas" onAction={() => navigate(`${base}/crm?tab=personas`)}>
        Personas
      </SectionLabel>
      <div className="overflow-hidden rounded-xl border border-border">
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
          <PageSkeleton variant="list" count={3} />
        ) : (
          quickPeople.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 border-b border-border py-2 last:border-b-0",
                CARD_X,
              )}
            >
              <button
                type="button"
                onClick={() => navigate(`${base}/personas/${c.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-foreground">
                  {initials(c.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {c.full_name}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {c.phone}
                  </span>
                </span>
              </button>
              <a
                href={`tel:${c.phone}`}
                aria-label={`Llamar a ${c.full_name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-90"
              >
                <Phone className="size-[17px]" strokeWidth={1.9} />
              </a>
              <a
                href={`https://wa.me/${c.phone?.replace(/[^\d]/g, "") ?? ""}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp a ${c.full_name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary transition active:scale-90"
              >
                <WhatsAppMark className="size-[18px]" />
              </a>
            </div>
          ))
        )}
      </div>
    </section>
  );

  const pendingCard = pendingCount > 0 && (
    <button
      type="button"
      onClick={() => navigate(`${base}/pendientes`)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-border py-3 text-left transition hover:bg-secondary/50",
        CARD_X,
      )}
    >
      <Inbox className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
        Pendientes
      </span>
      <Pill tone="accent">{pendingCount}</Pill>
    </button>
  );

  const activityWidget = activity.length > 0 && (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionLabel action="Ver todo" onAction={() => navigate(`${base}/crm?tab=interacciones`)}>
        Actividad
      </SectionLabel>
      <div className="overflow-hidden rounded-xl border border-border">
        {activity.slice(0, 5).map((it) => (
          <div key={it.id} className={cn("border-b border-border py-2.5 last:border-b-0", CARD_X)}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-foreground">
                {INTERACTION_KIND_LABELS[it.kind] ?? it.kind}
              </span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                {it.occurred_at ? format(new Date(it.occurred_at), "d MMM", { locale: es }) : ""}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {it.summary || "Sin resumen"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    // Width steps, not one jump. The page used to go max-w-2xl -> lg:max-w-6xl
    // with nothing in between, so 672–1024px was a dead zone and a 2560px
    // monitor left ~1100px of empty gutter. Above xl the page becomes two real
    // columns instead of one very long one; the breakpoint is xl and not lg
    // because the desktop shell already spends up to 240px on the sidebar.
    <div className="mx-auto w-full max-w-2xl px-[var(--page-x)] pt-4 pb-8 md:max-w-3xl lg:max-w-5xl lg:pt-6 xl:max-w-[78rem] 2xl:max-w-[92rem]">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground lg:text-[26px]">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
              {format(today, "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>

          {todayFeed.isError ? (
            <ErrorState
              compact
              message="No se pudo cargar tu agenda de hoy."
              error={todayFeed.error}
              onRetry={() => todayFeed.refetch()}
            />
          ) : (
            agendaWidget
          )}

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
              pipelineStrip
            ))}
        </div>

        {/* Below xl this is simply the rest of the single column. */}
        <aside className="flex min-w-0 flex-col gap-4">
          {pendingCard}
          {allow("crm") &&
            (quickPeople.length > 0 || contactsQ.isPending || contactsQ.isError) &&
            peopleWidget}
          {allow("crm") && activityWidget}
        </aside>
      </div>
    </div>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default AdminHomePage;
