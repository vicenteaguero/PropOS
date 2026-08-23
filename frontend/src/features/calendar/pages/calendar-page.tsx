import { useEffect, useMemo, useRef, useState } from "react";
import { useOpenOnParam } from "@shared/hooks/use-open-on-param";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { ConfirmDialog } from "@shared/components/confirm-dialog/confirm-dialog";
import {
  ActionIcon,
  AppShellScroll,
  ErrorState,
  FOCUS_RING,
  PageSkeleton,
  ResponsiveSheet,
  Row,
  SectionLabel,
  SheetActions,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@shared/hooks/use-auth";
import { useAgentOverlay } from "@features/agent/components/agent-overlay-host";
import {
  useCalendarFeed,
  useCreateEvent,
  useDeleteEvent,
  useEvent,
  useUpdateEvent,
} from "../hooks/use-calendar";
import type { CalendarItem } from "../api/calendar-api";
import { CalendarToolbar, type MobileView as ToolbarView } from "../components/calendar-toolbar";
import { WeekCarousel } from "../components/week-carousel";
import { EventRow as DenseEventRow } from "../components/event-row";
import { VisitNavRow } from "../components/visit-nav-row";
import { EventDetailDialog } from "../components/event-detail-dialog";
import { dayHeading as dayHeadingOneLine, feedRange, weekDaysOf } from "../lib/calendar-range";
import { placeOverlapping } from "../lib/overlap";
import {
  filterFromParam,
  isImminentVisit,
  itemMeta,
  matchesFilter,
  paramForFilter,
  timeLabel,
  type CalFilter,
  type TypeResolver,
} from "../lib/calendar-item";
import { dayKey } from "../lib/calendar-range";
import { UPCOMING_PAGE_DAYS, upcomingDays, upcomingWindow } from "../lib/upcoming";
import { EventForm, emptyEventForm, type EventFormState } from "../components/event-form";
import { useEventTypes } from "../hooks/use-event-types";
import { useTopbarActionsSlot } from "@layouts/topbar-slot";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

type View = "month" | "week" | "day";

type MobileView = "day" | "week" | "month";

/** Time-grid geometry: one hour = HOUR_PX tall, full 24h column. */
const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Minutes from midnight for a timed item (0 when missing). */
function startMinutes(it: CalendarItem): number {
  if (!it.start_at) return 0;
  const d = new Date(it.start_at);
  return d.getHours() * 60 + d.getMinutes();
}

/** Block height in px for an item, floored to a readable minimum. */
function durationPx(it: CalendarItem): number {
  if (!it.start_at) return HOUR_PX;
  const start = new Date(it.start_at).getTime();
  const end = it.end_at ? new Date(it.end_at).getTime() : start + 60 * 60 * 1000;
  const minutes = Math.max(30, (end - start) / 60000);
  return (minutes / 60) * HOUR_PX;
}

/**
 * A sensible start for a brand-new event: the next half hour, today.
 *
 * Not "now": an event that starts at 14:37 is nobody's intention, and the old
 * form's empty date field made the first thing you did on every event be
 * typing a date you already knew.
 */
function defaultStart(): Date {
  const at = new Date();
  at.setSeconds(0, 0);
  at.setMinutes(at.getMinutes() > 30 ? 60 : 30);
  return at;
}

export function CalendarPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const { resolve: resolveType } = useEventTypes();
  // Days shown in the month view's upcoming list. Widens the FEED window, not
  // just the render — the whole point is not to fetch a year of events.
  const [upcomingDaysCount, setUpcomingDaysCount] = useState(UPCOMING_PAGE_DAYS);
  const [view, setView] = useState<View>("month");
  // Mobile drives Día/Semana/Mes independently from the desktop time-grid view.
  const [mobileView, setMobileView] = useState<MobileView>("day");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventFormState>(() => emptyEventForm(defaultStart()));
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const propo = useAgentOverlay();
  const [params, setParams] = useSearchParams();
  // In the URL so the phone's Back button undoes it and so a filtered calendar
  // can be linked to. `view` and the anchor deliberately stay out: a swipe per
  // history entry would make Back useless.
  const filter = filterFromParam(params.get("tipo"));
  const setFilter = (next: CalFilter) =>
    setParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        const value = paramForFilter(next);
        if (value) sp.set("tipo", value);
        else sp.delete("tipo");
        return sp;
      },
      { replace: true },
    );

  // Propo (agent pipeline) is backend ADMIN-only — mirror the Home gate.
  const role = (user?.role ?? "ADMIN").toLowerCase();
  const scope = user?.adminScope ?? [];
  const canPropo = role === "admin" && (scope.length === 0 || scope.includes("agent"));

  // Desktop defaults to the week time-grid the first time we know we're on a
  // wide viewport; once the user picks a view we stop auto-switching.
  const userPickedView = useRef(false);
  const appliedDesktopDefault = useRef(false);
  useEffect(() => {
    if (isDesktop && !userPickedView.current && !appliedDesktopDefault.current) {
      appliedDesktopDefault.current = true;
      setView("week");
    }
  }, [isDesktop]);

  const pickView = (v: View) => {
    userPickedView.current = true;
    setView(v);
  };

  // Coming back to the tab re-anchors the Día view on today. Leaving it parked
  // on whatever day you last tapped means the calendar opens showing a
  // Thursday in three weeks, with nothing on screen saying why.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const today = new Date();
      setSelected((current) => (isSameDay(current, today) ? current : today));
      setUpcomingDaysCount(UPCOMING_PAGE_DAYS);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Desktop drives the time-grid / month-grid view; mobile has its own
  // `mobileView` state, so the desktop view is parked on month off-desktop.
  const activeView: View = isDesktop ? view : "month";

  // Desktop visible range drives the desktop time-grid / month-grid.
  const { rangeStart, rangeEnd, gridDays } = useMemo(() => {
    if (activeView === "day") {
      const start = startOfDay(cursor);
      return { rangeStart: start, rangeEnd: addDays(start, 1), gridDays: [start] };
    }
    if (activeView === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = endOfWeek(cursor, { weekStartsOn: 1 });
      return {
        rangeStart: start,
        rangeEnd: addDays(end, 1),
        gridDays: eachDayOfInterval({ start, end }),
      };
    }
    const monthStart = startOfMonth(cursor);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return {
      rangeStart: start,
      rangeEnd: end,
      gridDays: eachDayOfInterval({ start, end }),
    };
  }, [activeView, cursor]);

  // Mobile range is anchored on `selected` and driven by the mobile view.
  // `weekDays` always covers the selected week (the day-strip); `monthDays`
  // covers the month grid for the Mes view.
  const { monthDays } = useMemo(() => {
    const monthGridStart = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 });
    const monthGridEnd = endOfWeek(endOfMonth(selected), { weekStartsOn: 1 });
    const month = eachDayOfInterval({ start: monthGridStart, end: monthGridEnd });
    return { monthDays: month };
  }, [selected]);

  // One tree is mounted at a time now, so the window is whichever one is on
  // screen — and on mobile it is quantised to whole weeks (see `feedRange`), so
  // moving between days inside a week reuses the same cache entry instead of
  // refetching the feed on every tap.
  const { queryStart, queryEnd } = useMemo(() => {
    if (isDesktop) {
      // The month view draws the upcoming list beside the grid, and its pages
      // run past the end of the month.
      const upcomingEnd = upcomingWindow(upcomingDaysCount).to;
      return {
        queryStart: rangeStart,
        queryEnd: activeView === "month" && upcomingEnd > rangeEnd ? upcomingEnd : rangeEnd,
      };
    }
    const { start, end } = feedRange(selected, mobileView);
    if (mobileView !== "month") return { queryStart: start, queryEnd: end };
    // The month view also draws the upcoming list, whose pages extend past the
    // month grid. Widen the window rather than paginating an array we already
    // paid to fetch — the reason for paging at all is the request, not the map.
    const upcomingEnd = upcomingWindow(upcomingDaysCount).to;
    return { queryStart: start, queryEnd: upcomingEnd > end ? upcomingEnd : end };
  }, [isDesktop, activeView, rangeStart, rangeEnd, selected, mobileView, upcomingDaysCount]);

  const { data, isLoading, error, refetch } = useCalendarFeed(
    queryStart.toISOString(),
    queryEnd.toISOString(),
  );
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();

  // Only real events are editable: tasks and payments live in other tables and
  // the feed row omits location, so the detail sheet loads the full row.
  const editableId = detail?.item_type === "EVENT" ? detail.id : undefined;
  const {
    data: fullEvent,
    isLoading: loadingEvent,
    error: eventError,
    refetch: refetchEvent,
  } = useEvent(editableId);

  const itemsByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of data ?? []) {
      if (!it.start_at) continue;
      if (!matchesFilter(it, filter)) continue;
      const key = format(new Date(it.start_at), "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const at = (a.start_at ?? "").localeCompare(b.start_at ?? "");
        // Priority breaks ties INSIDE an hour, it does not override the clock:
        // an urgent thing at 16:00 does not happen before a normal one at
        // 09:00, and a calendar that claimed otherwise would be lying.
        if (at !== 0) return at;
        return (b.priority ?? 0) - (a.priority ?? 0);
      });
    }
    return m;
  }, [data, filter]);

  const selectedKey = dayKey(selected);
  const selectedItems = itemsByDay.get(selectedKey) ?? [];

  // Period label adapts to the active view. On mobile it follows `selected`
  // and the mobile view; on desktop it follows `cursor` and the desktop view.
  const periodLabel = useMemo(() => {
    if (!isDesktop) {
      if (mobileView === "month") return format(selected, "MMMM yyyy", { locale: es });
      const s = startOfWeek(selected, { weekStartsOn: 1 });
      const e = endOfWeek(selected, { weekStartsOn: 1 });
      return isSameMonth(s, e)
        ? `${format(s, "d", { locale: es })}–${format(e, "d 'de' MMMM", { locale: es })}`
        : `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`;
    }
    if (activeView === "day") return format(cursor, "EEEE d 'de' MMMM", { locale: es });
    if (activeView === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return isSameMonth(s, e)
        ? `${format(s, "d", { locale: es })}–${format(e, "d 'de' MMMM", { locale: es })}`
        : `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`;
    }
    return format(cursor, "MMMM yyyy", { locale: es });
  }, [isDesktop, mobileView, selected, activeView, cursor]);

  const step = (dir: 1 | -1) => {
    if (!isDesktop) {
      // Mobile steps the selected day by day/week/month.
      setSelected((d) => {
        if (mobileView === "day") return addDays(d, dir);
        if (mobileView === "week") return addWeeks(d, dir);
        return addMonths(d, dir);
      });
      return;
    }
    setCursor((c) => {
      if (activeView === "day") return addDays(c, dir);
      if (activeView === "week") return addWeeks(c, dir);
      return addMonths(c, dir);
    });
  };

  const goToday = () => {
    const today = new Date();
    setCursor(today);
    setSelected(today);
  };

  // Open the create sheet, optionally prefilled to a clicked day at 09:00.
  const openCreate = (day?: Date) => {
    const at = day ? new Date(day) : defaultStart();
    if (day) at.setHours(9, 0, 0, 0);
    setForm(emptyEventForm(at));
    setOpen(true);
  };

  useOpenOnParam("nuevo", () => openCreate());

  /**
   * The only rule left. `end > start` is now structurally impossible — the
   * `when-reducer` will not produce it — so the toast that used to say "la hora
   * de término debe ser posterior al inicio" has nothing left to fire on.
   */
  const validate = (f: EventFormState): boolean => {
    if (!f.title.trim()) {
      toast.error("El evento necesita un título");
      return false;
    }
    return true;
  };

  /** A reminder offset, resolved against whatever the start currently is. */
  const remindAtFrom = (f: EventFormState): string | null =>
    f.remindOffset === null
      ? null
      : new Date(f.start.getTime() - f.remindOffset * 60_000).toISOString();

  const bodyFrom = (f: EventFormState) => ({
    title: f.title.trim(),
    kind: f.kind,
    description: f.description.trim() || null,
    starts_at: f.start.toISOString(),
    ends_at: f.end.toISOString(),
    all_day: f.allDay,
    status: f.status as "SCHEDULED" | "DONE" | "CANCELLED",
    location: f.location.trim() || null,
    priority: f.priority,
    property_id: f.propertyId,
    contact_id: f.contactId,
    opportunity_id: f.opportunityId,
    assignee_user: f.assigneeUser,
  });

  const submit = async () => {
    if (!validate(form)) return;
    await create.mutateAsync({ ...bodyFrom(form), remind_at: remindAtFrom(form) });
    setForm(emptyEventForm(defaultStart()));
    setOpen(false);
    toast.success("Evento creado");
  };

  // Prefill from the full row (the button stays disabled until it lands, so a
  // failed fetch can never blank fields the feed does not carry) and hand the
  // sheet over from detail to edit.
  const openEdit = () => {
    if (!detail || !fullEvent) return;
    const start = new Date(fullEvent.starts_at);
    setForm({
      ...emptyEventForm(start, fullEvent.kind),
      title: fullEvent.title ?? "",
      end: fullEvent.ends_at ? new Date(fullEvent.ends_at) : new Date(start.getTime() + 3_600_000),
      allDay: fullEvent.all_day ?? false,
      location: fullEvent.location ?? "",
      description: fullEvent.description ?? "",
      status: fullEvent.status ?? "SCHEDULED",
      priority: fullEvent.priority ?? 0,
      propertyId: fullEvent.property_id ?? null,
      contactId: fullEvent.contact_id ?? null,
      opportunityId: fullEvent.opportunity_id ?? null,
      assigneeUser: fullEvent.assignee_user ?? null,
    });
    setEditingId(detail.id);
    setDetail(null);
  };

  const submitEdit = async () => {
    if (!editingId || !validate(form)) return;
    await update.mutateAsync({
      id: editingId,
      body: {
        ...bodyFrom(form),
        // Explicitly, both ways: a reminder that was set and is now "Sin
        // recordatorio" has to be removed, not merely left alone.
        ...(form.remindOffset === null
          ? { clear_reminder: true }
          : { remind_at: remindAtFrom(form) }),
      },
    });
    setEditingId(null);
    toast.success("Evento actualizado");
  };

  const confirmDelete = async () => {
    if (!detail) return;
    await remove.mutateAsync(detail.id);
    setConfirmingDelete(false);
    setDetail(null);
    toast.success("Evento eliminado");
  };

  const actionsHost = useTopbarActionsSlot();

  return (
    <>
      {/* The create action belongs in the bar on a phone, where the toolbar row
          below is already carrying the view switch, Agendar and the mic. On the
          sidebar shell there is no bar to portal into, so the desktop toolbar
          keeps its own button. */}
      {!isDesktop &&
        actionsHost &&
        createPortal(
          <Button
            onClick={() => openCreate()}
            variant="ink"
            size="icon"
            aria-label="Nuevo evento"
            className="rounded-full"
          >
            <ActionIcon name="createEvent" />
          </Button>,
          actionsHost,
        )}
      {/* Mobile keeps the capped (md) centered column; desktop goes full-bleed. */}
      <PageLayout width="app" noPadding className="max-w-4xl lg:max-w-none">
        <AppShellScroll>
          {/* Header + controls: fixed on desktop, normal flow on mobile. */}
          <div className="shrink-0">
            {/* One toolbar, not four rows.
                The period, the stepper, the view switch and the create action
                used to occupy three separate bands plus an empty PageHeader, so
                ~300px of a laptop screen was chrome before a single hour of the
                calendar was visible. */}
            {isDesktop && (
              <CalendarToolbar
                variant="desktop"
                view={view === "month" ? "month" : view === "week" ? "week" : "day"}
                onViewChange={(v) => pickView(v as View)}
                filter={filter}
                onFilterChange={setFilter}
                onSchedule={() => openCreate()}
                onVoice={() => propo.open("voice")}
                canPropo={canPropo}
                onStep={step}
                onToday={goToday}
                onCreate={() => openCreate()}
                periodLabel={activeView === "month" ? periodLabel : undefined}
              />
            )}

            {error && (
              <ErrorState
                message="No se pudo cargar el calendario."
                onRetry={() => refetch()}
                compact
                className="mx-5 mb-3 lg:mx-8"
              />
            )}
          </div>

          {/* One tree, not two behind `lg:hidden`.
              Both used to stay mounted, so every render did the work twice and
              the query window had to span the union of the two ranges — which
              is what made switching views refetch. It also disagreed with
              `useIsDesktop` (768px) about where the boundary was, so tablets
              got desktop state under a mobile layout. */}
          {!isDesktop && (
            <MobileCalendar
              mobileView={mobileView}
              onViewChange={setMobileView}
              selected={selected}
              onSelect={setSelected}
              monthDays={monthDays}
              itemsByDay={itemsByDay}
              isLoading={isLoading}
              onOpen={setDetail}
              canPropo={canPropo}
              onOpenPropo={() => propo.open("voice")}
              filter={filter}
              onFilterChange={setFilter}
              onCreate={() => openCreate()}
              role={role}
              resolveType={resolveType}
              upcomingDays={upcomingDaysCount}
              onLoadMoreDays={() => setUpcomingDaysCount((d) => d + UPCOMING_PAGE_DAYS)}
            />
          )}

          {/* ---- Desktop ---- */}
          {isDesktop && (
            <div className="flex min-h-0 flex-1 flex-col">
              {isLoading && <PageSkeleton variant="list" count={6} className="px-8 pt-2" />}

              {!isLoading && activeView === "month" && (
                <div className="flex min-h-0 flex-1 gap-6 px-8 pb-6 pt-2">
                  <div className="min-w-0 flex-[2]">
                    <MonthGrid
                      days={gridDays}
                      cursor={cursor}
                      selected={selected}
                      resolveType={resolveType}
                      itemsByDay={itemsByDay}
                      onSelect={(d) => {
                        // Selecting a day in the month grid drops into the Día view.
                        setSelected(d);
                        setCursor(d);
                        pickView("day");
                      }}
                      onCreate={openCreate}
                    />
                  </div>
                  <div className="flex min-h-0 w-80 shrink-0 flex-col overflow-y-auto rounded-xl border border-border">
                    {/* Same rule as the period heading: only the first letter.
                      `capitalize` gave "Jueves 21 De Agosto". */}
                    <SectionLabel className="mb-1 mt-3 px-4 first-letter:uppercase">
                      {format(selected, "EEEE d 'de' MMMM", { locale: es })}
                    </SectionLabel>
                    <DayAgenda items={selectedItems} onOpen={setDetail} resolveType={resolveType} />
                    {/* The same paginated "what is coming" list the phone gets.
                        The laptop had the month grid and one day's agenda and
                        no way to see the week ahead without clicking through
                        seven days. */}
                    <UpcomingList
                      itemsByDay={itemsByDay}
                      days={upcomingDaysCount}
                      onOpen={setDetail}
                      onLoadMore={() => setUpcomingDaysCount((d) => d + UPCOMING_PAGE_DAYS)}
                      canLoadMore
                      resolveType={resolveType}
                    />
                  </div>
                </div>
              )}

              {!isLoading && (activeView === "week" || activeView === "day") && (
                <TimeGrid
                  days={gridDays}
                  itemsByDay={itemsByDay}
                  onOpen={setDetail}
                  onCreate={openCreate}
                  resolveType={resolveType}
                />
              )}
            </div>
          )}
        </AppShellScroll>

        {/* Create flow */}
        <ResponsiveSheet open={open} onOpenChange={setOpen} title="Nuevo evento">
          <div className="mt-4 space-y-4">
            <EventForm value={form} onChange={setForm} />
            {/* One row, the way every other sheet in the app ends. Two
                full-width buttons stacked read as two steps. */}
            <SheetActions>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={create.isPending} variant="ink">
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Crear
              </Button>
            </SheetActions>
          </div>
        </ResponsiveSheet>

        {/* Edit flow */}
        <ResponsiveSheet
          open={!!editingId}
          onOpenChange={(o) => !o && setEditingId(null)}
          title="Editar evento"
        >
          <div className="mt-4 space-y-4">
            <EventForm value={form} onChange={setForm} showStatus />
            <SheetActions>
              <Button
                variant="ghost"
                onClick={() => setEditingId(null)}
                disabled={update.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={submitEdit} disabled={update.isPending} variant="ink">
                {update.isPending && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </Button>
            </SheetActions>
          </div>
        </ResponsiveSheet>

        {/* Event detail — a centred dialog on every size, not a drag-up sheet.
            See `EventDetailDialog` for why, and for what it now links to. */}
        <EventDetailDialog
          item={detail}
          full={fullEvent}
          loading={loadingEvent}
          error={eventError}
          onRetry={() => refetchEvent()}
          onOpenChange={(o) => !o && setDetail(null)}
          onEdit={openEdit}
          onDelete={() => setConfirmingDelete(true)}
          role={role}
        />

        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title="¿Eliminar evento?"
          description={`«${detail?.title ?? "Sin título"}» se quitará de la agenda. Esta acción se puede revertir desde el administrador de datos.`}
          confirmLabel="Eliminar"
          variant="destructive"
          loading={remove.isPending}
          onConfirm={confirmDelete}
        />
      </PageLayout>
    </>
  );
}

/** Month grid — identical mobile rendering; gains optional day-create on desktop. */
function MonthGrid({
  days,
  cursor,
  selected,
  itemsByDay,
  onSelect,
  onCreate,
  resolveType,
}: {
  days: Date[];
  cursor: Date;
  selected: Date;
  resolveType: TypeResolver;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (d: Date) => void;
  onCreate?: (d: Date) => void;
}) {
  return (
    <div className="px-[var(--page-x)] lg:px-0">
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-1 text-center text-xs font-semibold text-faint">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          const items = itemsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selected);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              onDoubleClick={onCreate ? () => onCreate(day) : undefined}
              className="flex flex-col items-center gap-1 py-1"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-semibold transition",
                  isSelected
                    ? "bg-ink text-ink-foreground"
                    : isToday
                      ? "text-primary"
                      : inMonth
                        ? "text-foreground hover:bg-secondary"
                        : "text-faint hover:bg-secondary",
                )}
              >
                {format(day, "d")}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {items.slice(0, 3).map((it) => (
                  <span
                    key={`${it.item_type}-${it.id}`}
                    className="size-1.5 rounded-full"
                    style={{
                      background: isSelected
                        ? "var(--color-background)"
                        : itemMeta(it, resolveType).ink,
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Selected-day list. Same Row layout as before; rows are now tappable to detail. */
function DayAgenda({
  items,
  onOpen,
  resolveType,
}: {
  items: CalendarItem[];
  onOpen: (it: CalendarItem) => void;
  resolveType: TypeResolver;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-[var(--page-x)] py-10 text-center">
        <CalendarDays className="size-9 text-faint" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden">
      {items.map((it, i) => {
        const meta = itemMeta(it, resolveType);
        // Already happened: quieter, but still readable and still tappable.
        // A past event is context — hiding it would break the shape of the day.
        const past = !!it.start_at && new Date(it.start_at) < new Date();
        return (
          <Row
            key={`${it.item_type}-${it.id}`}
            divider={i < items.length - 1}
            className={past ? "py-1.5 opacity-55" : undefined}
            onClick={() => onOpen(it)}
            left={
              <div className="flex w-12 shrink-0 items-center gap-2">
                <span className="h-9 w-1 rounded-full" style={{ background: meta.ink }} />
                <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                  {timeLabel(it)}
                </span>
              </div>
            }
            title={it.title ?? "Sin título"}
            right={
              // The type's own colour, not a `Pill` tone: a tenant's "Tasación"
              // has no semantic tone to map onto.
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: meta.wash, borderColor: meta.edge, color: meta.ink }}
              >
                {meta.label}
              </span>
            }
          />
        );
      })}
    </div>
  );
}

/** Desktop week/day time-grid. Hours down the left, day columns across. */
function TimeGrid({
  days,
  itemsByDay,
  onOpen,
  onCreate,
  resolveType,
}: {
  days: Date[];
  itemsByDay: Map<string, CalendarItem[]>;
  onOpen: (it: CalendarItem) => void;
  onCreate: (d: Date) => void;
  resolveType: TypeResolver;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to ~8am on first paint so the work day is in view.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX;
  }, []);

  const allDayByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const [key, list] of itemsByDay) {
      const allDay = list.filter((it) => it.all_day);
      if (allDay.length) m.set(key, allDay);
    }
    return m;
  }, [itemsByDay]);

  const hasAllDay = allDayByDay.size > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8 pb-6 pt-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
        {/* Day header row */}
        <div className="flex border-b border-border">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={dayKey(day)}
                className="flex flex-1 flex-col items-center gap-0.5 border-l border-border py-2"
              >
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {format(day, "EEE", { locale: es })}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                    isToday ? "bg-ink text-ink-foreground" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day strip */}
        {hasAllDay && (
          <div className="flex border-b border-border bg-secondary/30">
            <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-[11px] font-medium text-faint">
              Todo
            </div>
            {days.map((day) => {
              const items = allDayByDay.get(dayKey(day)) ?? [];
              return (
                <div key={dayKey(day)} className="flex-1 space-y-1 border-l border-border p-1">
                  {items.map((it) => (
                    <button
                      key={`${it.item_type}-${it.id}`}
                      type="button"
                      onClick={() => onOpen(it)}
                      className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-foreground"
                      style={{
                        background: itemMeta(it, resolveType).wash,
                      }}
                    >
                      {it.title ?? "Sin título"}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable hour grid */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex">
            {/* Hour gutter */}
            <div className="w-14 shrink-0">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="relative border-b border-border/60 text-right"
                  style={{ height: HOUR_PX }}
                >
                  <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-faint">
                    {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const timed = (itemsByDay.get(dayKey(day)) ?? []).filter((it) => !it.all_day);
              return (
                <div key={dayKey(day)} className="relative flex-1 border-l border-border">
                  {/* Hour cells (double-click to create at that hour) */}
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-label={`Crear a las ${h}:00`}
                      onDoubleClick={() => {
                        const at = new Date(day);
                        at.setHours(h, 0, 0, 0);
                        onCreate(at);
                      }}
                      className="block w-full border-b border-border/60 transition-colors hover:bg-secondary/40"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {/* Timed events, laid side by side when they overlap. */}
                  {placeOverlapping(timed).map(({ item: it, column, columns }) => {
                    const meta = itemMeta(it, resolveType);
                    const height = durationPx(it);
                    // Under ~34px there is only room for one line, so the time
                    // is dropped rather than clipped mid-glyph.
                    const tight = height < 34;
                    const width = `calc((100% - 0.5rem) / ${columns})`;
                    return (
                      <button
                        key={`${it.item_type}-${it.id}`}
                        type="button"
                        onClick={() => onOpen(it)}
                        title={it.title ?? "Sin título"}
                        className={cn(
                          "absolute overflow-hidden rounded-lg border-l-2 px-1.5 py-0.5 text-left ring-1 ring-background transition hover:z-10 hover:brightness-110",
                          // Same rule as the list views: what has happened
                          // steps back so what has not can be seen.
                          !!it.start_at && new Date(it.start_at) < new Date() && "opacity-55",
                        )}
                        style={{
                          top: (startMinutes(it) / 60) * HOUR_PX,
                          height,
                          left: `calc(0.25rem + ${column} * ${width})`,
                          width,
                          borderColor: meta.ink,
                          background: `color-mix(in oklab, ${meta.ink} 16%, var(--color-card))`,
                        }}
                      >
                        <span className="block truncate text-[11.5px] font-semibold leading-tight text-foreground">
                          {it.title ?? "Sin título"}
                        </span>
                        {!tight && (
                          <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">
                            {timeLabel(it)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-[var(--page-x)] py-12 text-center">
      <CalendarDays className="size-9 text-faint" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** 7-col month grid (aspect-square cells, today filled, event dots). */
function MobileMonthGrid({
  days,
  selected,
  itemsByDay,
  onSelect,
  resolveType,
}: {
  days: Date[];
  selected: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (d: Date) => void;
  resolveType: TypeResolver;
}) {
  const today = startOfDay(new Date());
  return (
    <div className="px-[var(--page-x)] pb-2">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-1 text-center text-[11px] font-bold text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const items = itemsByDay.get(dayKey(day)) ?? [];
          const inMonth = isSameMonth(day, selected);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selected);
          const filled = isSelected || (isToday && !isSelected);
          const past = day < today;
          // Up to three dots, each the colour of its own type. One dot in one
          // fixed colour said "something happens" and nothing else, which on a
          // month grid is the only question it was in a position to answer.
          const dots = items.slice(0, 3);
          // Something overdue or cancelled on that day earns a louder ring:
          // the month view is where you go looking for what went wrong.
          const critical = items.some(
            (it) =>
              (it.status ?? "").toUpperCase() === "CANCELLED" ||
              (it.item_type === "TASK" && it.start_at && new Date(it.start_at) < new Date()),
          );
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={`${format(day, "d 'de' MMMM", { locale: es })}, ${items.length} ${
                items.length === 1 ? "evento" : "eventos"
              }`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl transition active:scale-[0.95]",
                filled ? "bg-foreground" : "hover:bg-secondary",
                critical && !filled && "ring-1 ring-destructive/40",
                past && !filled && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "text-sm tabular-nums",
                  filled
                    ? "font-bold text-background"
                    : inMonth
                      ? "font-medium text-foreground"
                      : "font-medium text-faint",
                )}
              >
                {format(day, "d")}
              </span>
              <span className="flex h-1.5 items-center gap-[3px]">
                {dots.map((it, i) => (
                  <span
                    key={`${it.item_type}-${it.id}-${i}`}
                    className="size-1.5 rounded-full"
                    style={{
                      background: filled
                        ? "var(--color-background)"
                        : itemMeta(it, resolveType).ink,
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What is coming, under the month grid.
 *
 * Paginated by DAYS and at the data level, not by slicing an array that was
 * already fetched: each page widens the `from`/`to` window of the feed request.
 * A month view that pulled every event a tenant has is a thousand rows to draw
 * three hundred dots with.
 */
function UpcomingList({
  itemsByDay,
  days,
  onOpen,
  onLoadMore,
  canLoadMore,
  resolveType,
}: {
  itemsByDay: Map<string, CalendarItem[]>;
  days: number;
  onOpen: (it: CalendarItem) => void;
  onLoadMore: () => void;
  canLoadMore: boolean;
  resolveType: TypeResolver;
}) {
  const withItems = upcomingDays(itemsByDay, days);

  return (
    <div className="border-t border-border pb-6 pt-2">
      <SectionLabel className="px-[var(--page-x)] pb-1">Próximos</SectionLabel>
      {withItems.length === 0 ? (
        <MobileEmpty label="Nada agendado en estos días." />
      ) : (
        withItems.map((day) => (
          <div key={dayKey(day)}>
            <div className="px-[var(--page-x)] pb-1 pt-2.5">
              <span className="text-[15px] font-bold tracking-tight text-foreground">
                {dayHeadingOneLine(day)}
              </span>
            </div>
            {(itemsByDay.get(dayKey(day)) ?? []).map((it) => (
              <DenseEventRow
                key={`${it.item_type}-${it.id}`}
                item={it}
                onOpen={onOpen}
                resolveType={resolveType}
                past={!!it.start_at && new Date(it.start_at) < new Date()}
              />
            ))}
          </div>
        ))
      )}
      {canLoadMore && (
        <div className="px-[var(--page-x)] pt-3">
          <Button variant="outline" size="block" onClick={onLoadMore}>
            Cargar más días
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The week, starting at today.
 *
 * It used to render all seven days in order, so on a Friday five sixths of the
 * screen was Monday to Thursday — days you cannot do anything about. Everything
 * from today forward is the list; the days already gone are folded into one
 * disclosure above it, dimmed, still one tap away.
 */
function WeekList({
  days,
  itemsByDay,
  onOpen,
  resolveType,
}: {
  days: Date[];
  itemsByDay: Map<string, CalendarItem[]>;
  onOpen: (it: CalendarItem) => void;
  resolveType: TypeResolver;
}) {
  const today = startOfDay(new Date());
  const past = days.filter((d) => d < today);
  const ahead = days.filter((d) => d >= today);
  const pastCount = past.reduce((n, d) => n + (itemsByDay.get(dayKey(d)) ?? []).length, 0);

  const renderDay = (day: Date, dim: boolean) => {
    const items = itemsByDay.get(dayKey(day)) ?? [];
    if (!items.length) return null;
    return (
      <div key={dayKey(day)}>
        <div className="px-[var(--page-x)] pb-1.5 pt-3">
          <span
            className={cn(
              "text-[17px] font-bold tracking-tight",
              dim ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {dayHeadingOneLine(day)}
          </span>
        </div>
        {items.map((it) => (
          <div key={`${it.item_type}-${it.id}`}>
            <DenseEventRow
              item={it}
              onOpen={onOpen}
              resolveType={resolveType}
              past={dim || (!!it.start_at && new Date(it.start_at) < new Date())}
            />
            {!dim && isImminentVisit(it) && it.location && <VisitNavRow address={it.location} />}
          </div>
        ))}
      </div>
    );
  };

  const aheadRendered = ahead.map((d) => renderDay(d, false)).filter(Boolean);

  return (
    <div>
      {pastCount > 0 && (
        <details className="border-b border-border">
          <summary
            className={cn(
              "cursor-pointer list-none px-[var(--page-x)] py-2.5 text-[13px] font-semibold text-muted-foreground",
              FOCUS_RING,
            )}
          >
            Ver días anteriores ({pastCount})
          </summary>
          <div className="pb-2">{past.map((d) => renderDay(d, true))}</div>
        </details>
      )}
      {aheadRendered.length > 0 ? aheadRendered : <MobileEmpty label="Nada más esta semana." />}
    </div>
  );
}

/** Mobile calendar orchestrator: view switch + week strip + Día/Semana/Mes body. */
function MobileCalendar({
  mobileView,
  onViewChange,
  selected,
  onSelect,
  monthDays,
  itemsByDay,
  isLoading,
  onOpen,
  canPropo,
  onOpenPropo,
  filter,
  onFilterChange,
  onCreate,
  resolveType,
  upcomingDays: upcomingDayCount,
  onLoadMoreDays,
}: {
  mobileView: MobileView;
  onViewChange: (v: MobileView) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  monthDays: Date[];
  itemsByDay: Map<string, CalendarItem[]>;
  isLoading: boolean;
  onOpen: (it: CalendarItem) => void;
  canPropo: boolean;
  onOpenPropo: () => void;
  filter: CalFilter;
  onFilterChange: (f: CalFilter) => void;
  onCreate: () => void;
  role: string;
  resolveType: TypeResolver;
  upcomingDays: number;
  onLoadMoreDays: () => void;
}) {
  // Tapping a month-grid day selects it and drops back into the Día view.
  const selectFromMonth = (d: Date) => {
    onSelect(d);
    onViewChange("day");
  };

  const selectedItems = itemsByDay.get(dayKey(selected)) ?? [];
  const weekDays = weekDaysOf(selected);

  return (
    <div className="pb-6">
      <CalendarToolbar
        view={mobileView as ToolbarView}
        onViewChange={(v) => onViewChange(v as MobileView)}
        filter={filter}
        onFilterChange={onFilterChange}
        onSchedule={onCreate}
        onVoice={onOpenPropo}
        canPropo={canPropo}
      />

      {mobileView !== "month" && (
        <div className="pb-2">
          <WeekCarousel anchor={selected} itemsByDay={itemsByDay} onSelect={onSelect} />
        </div>
      )}

      {isLoading ? (
        <PageSkeleton variant="list" count={4} />
      ) : mobileView === "day" ? (
        <div>
          {/* One line, one size. It used to print the weekday large and then
              "lun 17 ago" small beside it — the same day twice, in a row that
              had room for neither. */}
          <div className="px-[var(--page-x)] pb-1.5 pt-1">
            <span className="text-[19px] font-bold tracking-tight text-foreground">
              {dayHeadingOneLine(selected)}
            </span>
          </div>
          {selectedItems.length ? (
            selectedItems.map((it) => (
              <div key={`${it.item_type}-${it.id}`}>
                <DenseEventRow
                  item={it}
                  onOpen={onOpen}
                  resolveType={resolveType}
                  past={!!it.start_at && new Date(it.start_at) < new Date()}
                />
                {isImminentVisit(it) && it.location && <VisitNavRow address={it.location} />}
              </div>
            ))
          ) : (
            <MobileEmpty label="Sin eventos este día." />
          )}
        </div>
      ) : mobileView === "week" ? (
        <WeekList
          days={weekDays}
          itemsByDay={itemsByDay}
          onOpen={onOpen}
          resolveType={resolveType}
        />
      ) : (
        <>
          <MobileMonthGrid
            days={monthDays}
            selected={selected}
            itemsByDay={itemsByDay}
            onSelect={selectFromMonth}
            resolveType={resolveType}
          />
          <UpcomingList
            itemsByDay={itemsByDay}
            days={upcomingDayCount}
            onOpen={onOpen}
            onLoadMore={onLoadMoreDays}
            canLoadMore
            resolveType={resolveType}
          />
        </>
      )}
    </div>
  );
}
