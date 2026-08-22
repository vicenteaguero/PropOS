import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Inbox,
  Mic,
  Phone,
  Receipt,
  Sparkles,
  StickyNote,
  Upload,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentName } from "@core/branding/agent-branding";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { propertiesApi } from "@features/admin-properties/api/properties-api";
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
  NavMark,
  PageSkeleton,
  SectionLabel,
  WhatsAppMark,
  type PillTone,
} from "@shared/ui";
import { cn } from "@/lib/utils";
import { initials } from "@shared/utils/format";
import { DataHealthCard } from "../components/data-health-card";
import { AttentionCard } from "@features/attention/components/attention-card";
import { timeAgo } from "@shared/utils/relative-time";
import { getNavApp, navHref, NAV_APP_LABEL } from "@shared/lib/nav-app";

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
  // The tile grid means something different once a sidebar is on screen.

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

  // Three open-pipeline counts answer "what is in flight" but nothing answered
  // "did any of it land". Won deals are a separate query because the strip above
  // deliberately asks for status=OPEN.
  const wonQ = useOpportunities({ status: "WON", limit: 100 });
  const monthStart = startOfMonth(new Date()).toISOString();
  const cierresDelMes = (wonQ.data ?? []).filter(
    (o) => (o.updated_at ?? o.created_at ?? "") >= monthStart,
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
  // The calendar feed carries the address now (see v_calendar_feed), so offering
  // directions costs nothing extra here — no request per item, no detail fetch.
  const navApp = getNavApp();
  const nextHref = navHref(nextItem?.location, navApp);

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

  /**
   * Starting points, not a second navigation — on every viewport.
   *
   * These used to be destinations on a phone and actions on a desktop, which
   * had the ergonomics backwards. The phone already carries Inicio, Clientes,
   * Agenda and Más in the bottom nav, so a grid of destinations mostly repeated
   * the bar directly beneath it, while the actions the bar does NOT offer had
   * no home at all: creating a person cost Clientes → Personas → +, three taps,
   * against one click on a desktop that needs the help least.
   *
   * The query params below are read by each surface to open its create sheet,
   * which is why they are links and not callbacks: the action survives a
   * refresh, can be linked to, and — because `useOpenOnParam` is viewport-blind
   * — already worked on a phone before anything pointed at it.
   */
  const actionTiles: Tile[] = [
    {
      to: `${base}/agenda?tab=calendario&nuevo=1`,
      label: "Agendar",
      icon: CalendarPlus,
      scope: "productividad",
    },
    {
      to: `${base}/clientes?tab=personas&nuevo=1`,
      label: "Nuevo contacto",
      icon: UserPlus,
      scope: "crm",
    },
    {
      to: `${base}/clientes?tab=propiedades&nuevo=1`,
      label: "Agregar propiedad",
      icon: Building2,
    },
    {
      to: `${base}/documentos?nuevo=1`,
      label: "Subir documento",
      icon: Upload,
      scope: "documents",
    },
    {
      to: "/admin/finanzas?nuevo=1",
      label: "Agregar gasto",
      icon: Receipt,
      scope: "finanzas",
      adminOnly: true,
    },
    {
      to: `${base}/agenda?tab=notas&nuevo=1`,
      label: "Nueva nota",
      icon: StickyNote,
      scope: "productividad",
    },
  ];

  const tiles = actionTiles.filter((t) => allow(t.scope) && (!t.adminOnly || isAdmin));

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
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
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
        className="flex w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-ink-foreground transition active:scale-95"
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
    <div className="overflow-hidden rounded-xl bg-ink text-ink-foreground">
      {/* The row is a flex container so the directions button can sit beside
          the main target rather than inside it — a link inside a button is
          invalid and unreachable by keyboard. */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate(`${base}/agenda`)}
          className={cn("flex min-w-0 flex-1 items-center gap-3 py-3 text-left", CARD_X)}
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
        {/* The one thing a broker does with the next appointment, from the
            screen they are already on. Which app opens it is theirs to pick
            (Configuración → Cómo llegar); the button only exists when the feed
            actually knows an address. */}
        {nextHref && (
          <a
            href={nextHref}
            target="_blank"
            rel="noreferrer"
            aria-label={`Cómo llegar con ${NAV_APP_LABEL[navApp]}`}
            className="mr-[var(--page-x)] flex size-11 shrink-0 items-center justify-center rounded-full bg-background/10 transition active:scale-90"
          >
            <NavMark app={navApp} size={26} />
          </a>
        )}
      </div>

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
      onClick={() => navigate(`${base}/clientes?tab=negocios`)}
      aria-label="Ver negocios"
      className={cn(
        "grid w-full grid-cols-4 items-start gap-2 rounded-xl border border-border bg-background py-3 transition hover:border-primary/40",
        CARD_X,
      )}
    >
      {/* An equal grid, not a flex row with a chevron on the end. The chevron
          took a column's worth of width out of the last figure, so `flex-1`
          handed the four spans unequal room and the numbers — which are read by
          comparing them — no longer lined up under their labels. The whole strip
          is one target; it does not need an arrow to say so. */}
      {[
        { value: leadsActivos, label: "Leads" },
        { value: enVisita, label: "En visita" },
        { value: negociacion, label: "Negociación" },
        { value: cierresDelMes, label: "Cerrados" },
      ].map((stat) => (
        <span key={stat.label} className="flex min-w-0 flex-col items-center text-center">
          {/* Ink, not the brand accent. Colour in this app means money — pine
              for what comes in, brick for what goes out — so tinting a headcount
              green made three neutral figures read as revenue. */}
          <span className="block font-display text-2xl font-semibold leading-none tabular-nums text-foreground">
            {oppsQ.isPending ? "…" : stat.value}
          </span>
          <span className="mt-1.5 block w-full truncate text-[11.5px] leading-tight text-muted-foreground">
            {stat.label}
          </span>
        </span>
      ))}
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
      <SectionLabel action="Ver todas" onAction={() => navigate(`${base}/clientes?tab=personas`)}>
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

  /**
   * The proposal queue, at the top of the page and on the brand accent.
   *
   * It used to be an outlined row in the right-hand column, below attention and
   * data health — the same weight as everything around it, for the one thing on
   * this screen that is blocking: until these are reviewed, what Propo heard in
   * a conversation is not in the CRM. It leads the page whenever it is non-empty
   * and disappears entirely when it is, so it never becomes a permanent fixture
   * the eye learns to skip.
   */
  /**
   * Propiedades, as a strip of photos.
   *
   * The people widget beside it works because a broker recognises a name. They
   * recognise a property by its FACE — the photo does in a glance what a title
   * cannot, and "Departamento 2D/2B en venta en Ñuñoa" is four of those in a
   * column that all read the same. Three covers, the address underneath, and
   * the layout in the corner: enough to pick one out and open it.
   *
   * Warmed in the background by `core/query/warmup.tsx`, so tapping through is
   * instant and the fetch never competes with the first paint.
   */
  const propertiesQ = useQuery({
    queryKey: ["properties", "list", { limit: 6 }],
    queryFn: () => propertiesApi.list({ limit: 6 }),
    staleTime: 60_000,
    enabled: allow("crm"),
  });
  const recentProperties = (propertiesQ.data ?? []).slice(0, 3);

  const propertiesWidget = recentProperties.length > 0 && (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionLabel
        action="Ver todas"
        onAction={() => navigate(`${base}/clientes?tab=propiedades`)}
      >
        Propiedades
      </SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {recentProperties.map((p) => {
          const layout = [p.bedrooms, p.bathrooms].every((n) => n == null)
            ? null
            : `${p.bedrooms ?? "–"}D/${p.bathrooms ?? "–"}B`;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`${base}/propiedades/${p.id}`)}
              className="min-w-0 text-left transition active:scale-[0.98]"
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-secondary">
                {p.cover_url && (
                  <img
                    src={p.cover_url}
                    // The 400px derivative is plenty at a third of a phone.
                    srcSet={p.cover_thumb_url ? `${p.cover_thumb_url} 400w` : undefined}
                    sizes="33vw"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                )}
                {layout && (
                  <span className="absolute bottom-1 left-1 rounded-md bg-background/80 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-foreground backdrop-blur-sm">
                    {layout}
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                {p.address ?? p.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const pendingCard = pendingCount > 0 && (
    <button
      type="button"
      onClick={() => navigate(`${base}/pendientes`)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-primary/35 bg-primary/10 py-3 text-left transition hover:bg-primary/15 active:scale-[0.99]",
        CARD_X,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Inbox className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">
          {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"} de {agentName}
        </span>
        <span className="block truncate text-[12.5px] text-muted-foreground">
          Revisa lo que Propo propone
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-primary" />
    </button>
  );

  const activityWidget = activity.length > 0 && (
    <section className="flex min-w-0 flex-col gap-2">
      <SectionLabel action="Ver todo" onAction={() => navigate(`${base}/clientes?tab=personas`)}>
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
                {timeAgo(it.occurred_at)}
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

          {/* Blocking work first, then the way to create more of it. Propo's
              queue is the only thing here that goes stale if ignored, so it
              outranks the composer that fills it. */}
          {pendingCard}

          {/* Asking is the fastest way in, and it is the one control that
              answers any question. The agenda below is what is already
              scheduled. */}
          {propoBar}

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

          {/* auto-fill instead of a fixed column count: three tiles on a phone,
              as many as fit on a tablet or a wide window, with no breakpoint to
              keep in sync with the tile list. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
            {tiles.map((t) => (
              <button
                key={t.to}
                type="button"
                onClick={() => navigate(t.to)}
                // Fixed height, not padding-derived: the labels became verbs
                // ("Agregar propiedad") and wrap to two lines on a 390px phone,
                // which would otherwise leave the one-line tiles short and the
                // grid ragged.
                className="flex h-[4.75rem] flex-col items-center justify-center gap-1 rounded-xl bg-secondary px-1 transition hover:bg-muted active:scale-[0.97]"
              >
                <t.icon className="size-[22px] shrink-0 text-foreground" strokeWidth={1.8} />
                <TileLabel label={t.label} />
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
          {/* What is waiting on a person, before what is wrong with the data. */}
          {allow("crm") && <AttentionCard />}
          {/* Data problems belong where the day starts, not buried in settings:
              nobody goes looking for inconsistencies they do not know exist. */}
          {allow("crm") && <DataHealthCard />}
          {allow("crm") && propertiesWidget}
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

/**
 * A tile label that breaks on the space instead of wherever the box runs out.
 *
 * Every label here is a verb phrase, and left to wrap on its own "Agregar
 * propiedad" and "Nuevo contacto" broke at different points, so a row of tiles
 * read as ragged. Two words become two centred lines, always the same way.
 *
 * Only two-word labels are split. The tile height is fixed (so one- and
 * two-line tiles stay flush), which means a three-word label rendered one word
 * per line would overflow it -- those fall back to normal wrapping, clamped.
 */
function TileLabel({ label }: { label: string }) {
  const words = label.split(" ");
  return (
    <span className="w-full text-center text-[11.5px] font-medium leading-tight text-foreground">
      {words.length === 2 ? (
        words.map((word) => (
          <span key={word} className="block truncate">
            {word}
          </span>
        ))
      ) : (
        <span className="line-clamp-2 block">{label}</span>
      )}
    </span>
  );
}
