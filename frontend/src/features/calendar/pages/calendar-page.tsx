import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  ListTodo,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import {
  AppShellScroll,
  Pill,
  ResponsiveSheet,
  Row,
  RoundButton,
  SectionLabel,
  Segmented,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@shared/hooks/use-auth";
import { AgentOverlay } from "@features/agent/components/agent-overlay";
import { useCalendarFeed, useCreateEvent } from "../hooks/use-calendar";
import type { CalendarItem } from "../api/calendar-api";
import type { PillTone } from "@shared/ui";

/** Per-type tone + dot color + kind icon (semantic tokens only). */
const TYPE_META: Record<
  CalendarItem["item_type"],
  { tone: PillTone; dot: string; label: string; icon: LucideIcon }
> = {
  EVENT: { tone: "accent", dot: "var(--color-accent-brand)", label: "Evento", icon: MapPin },
  TASK: { tone: "warning", dot: "var(--color-warning)", label: "Tarea", icon: ListTodo },
  PAYMENT: { tone: "success", dot: "var(--color-success)", label: "Pago", icon: Banknote },
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

type View = "month" | "week" | "day";

/** Mobile view order matches the mockup: Día / Semana / Mes. */
type MobileView = "day" | "week" | "month";

const MOBILE_VIEW_ITEMS: { id: MobileView; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mes" },
];

const VIEW_ITEMS = [
  { id: "month", label: "Mes" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Día" },
];

/** Time-grid geometry: one hour = HOUR_PX tall, full 24h column. */
const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function timeLabel(it: CalendarItem): string {
  if (it.all_day || !it.start_at) return "Todo";
  return format(new Date(it.start_at), "HH:mm");
}

/** Compact duration shown under the time (e.g. "1h", "45 min", "1h 30") or "Todo". */
function durationLabel(it: CalendarItem): string {
  if (it.all_day || !it.start_at) return "Todo";
  if (!it.end_at) return "1h";
  const minutes = Math.round(
    (new Date(it.end_at).getTime() - new Date(it.start_at).getTime()) / 60000,
  );
  if (minutes <= 0) return "1h";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}`;
}

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

export function CalendarPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<View>("month");
  // Mobile drives Día/Semana/Mes independently from the desktop time-grid view.
  const [mobileView, setMobileView] = useState<MobileView>("day");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  const [propoOpen, setPropoOpen] = useState(false);

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
  const { mobileRangeStart, mobileRangeEnd, weekDays, monthDays } = useMemo(() => {
    const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selected, { weekStartsOn: 1 });
    const week = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const monthGridStart = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 });
    const monthGridEnd = endOfWeek(endOfMonth(selected), { weekStartsOn: 1 });
    const month = eachDayOfInterval({ start: monthGridStart, end: monthGridEnd });
    // Range must cover whatever the active mobile view renders.
    const start = mobileView === "month" ? monthGridStart : weekStart;
    const end = mobileView === "month" ? addDays(monthGridEnd, 1) : addDays(weekEnd, 1);
    return {
      mobileRangeStart: start,
      mobileRangeEnd: end,
      weekDays: week,
      monthDays: month,
    };
  }, [selected, mobileView]);

  // Both the mobile and desktop trees stay mounted (toggled via CSS), so the
  // single query window must span the union of both ranges.
  const queryStart = useMemo(
    () => (rangeStart < mobileRangeStart ? rangeStart : mobileRangeStart),
    [rangeStart, mobileRangeStart],
  );
  const queryEnd = useMemo(
    () => (rangeEnd > mobileRangeEnd ? rangeEnd : mobileRangeEnd),
    [rangeEnd, mobileRangeEnd],
  );

  const { data, isLoading, error, refetch } = useCalendarFeed(
    queryStart.toISOString(),
    queryEnd.toISOString(),
  );
  const create = useCreateEvent();

  const itemsByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of data ?? []) {
      if (!it.start_at) continue;
      const key = format(new Date(it.start_at), "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(it);
    }
    for (const list of m.values()) {
      list.sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""));
    }
    return m;
  }, [data]);

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
    if (day) {
      const at = new Date(day);
      at.setHours(9, 0, 0, 0);
      setStartsAt(format(at, "yyyy-MM-dd'T'HH:mm"));
    }
    setOpen(true);
  };

  const submit = async () => {
    if (!title.trim() || !startsAt) {
      toast.error("Título y fecha son obligatorios");
      return;
    }
    await create.mutateAsync({ title: title.trim(), starts_at: new Date(startsAt).toISOString() });
    setTitle("");
    setStartsAt("");
    setOpen(false);
    toast.success("Evento creado");
  };

  return (
    <>
      {/* Mobile keeps the capped (md) centered column; desktop goes full-bleed. */}
      <PageLayout width="app" noPadding className="max-w-4xl lg:max-w-none">
        <AppShellScroll>
          {/* Header + controls: fixed on desktop, normal flow on mobile. */}
          <div className="shrink-0">
            <div className="px-5 pt-4 pb-4 lg:px-8 lg:pt-7">
              <PageHeader
                title="Calendario"
                description="Visitas, vencimientos y pagos del equipo."
                className="mb-0"
                actions={
                  <Button onClick={() => openCreate()} variant="ink" className="gap-2">
                    <Plus className="size-4" strokeWidth={1.8} />
                    Nuevo evento
                  </Button>
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pb-3 lg:px-8">
              <h2 className="truncate text-xl font-bold capitalize tracking-tight text-foreground">
                {periodLabel}
              </h2>
              <div className="flex items-center gap-1.5">
                <RoundButton onClick={() => step(-1)} aria-label="Anterior">
                  <ChevronLeft className="size-5" strokeWidth={1.8} />
                </RoundButton>
                <Button variant="secondary" size="sm" className="rounded-full" onClick={goToday}>
                  Hoy
                </Button>
                <RoundButton onClick={() => step(1)} aria-label="Siguiente">
                  <ChevronRight className="size-5" strokeWidth={1.8} />
                </RoundButton>
              </div>
            </div>

            {/* View toggle — desktop only (mobile stays the month grid). */}
            <div className="hidden lg:block">
              <Segmented
                items={VIEW_ITEMS}
                value={view}
                onChange={(v) => pickView(v as View)}
                className="px-8"
              />
            </div>

            {error && (
              <div className="mx-5 mb-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive lg:mx-8">
                No se pudo cargar el calendario.
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            )}
          </div>

          {/* Body. Mobile: Día / Semana / Mes (rebuilt). Desktop: per-view. */}
          {/* ---- Mobile ---- */}
          <div className="lg:hidden">
            <MobileCalendar
              mobileView={mobileView}
              onViewChange={setMobileView}
              selected={selected}
              onSelect={setSelected}
              weekDays={weekDays}
              monthDays={monthDays}
              itemsByDay={itemsByDay}
              isLoading={isLoading}
              onOpen={setDetail}
              canPropo={canPropo}
              onOpenPropo={() => setPropoOpen(true)}
            />
          </div>

          {/* ---- Desktop ---- */}
          <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col">
            {canPropo && (
              <div className="px-8 pb-1 pt-2">
                <PropoCard onOpen={() => setPropoOpen(true)} />
              </div>
            )}

            {isLoading && (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && activeView === "month" && (
              <div className="flex min-h-0 flex-1 gap-6 px-8 pb-6 pt-2">
                <div className="min-w-0 flex-[2]">
                  <MonthGrid
                    days={gridDays}
                    cursor={cursor}
                    selected={selected}
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
                <div className="flex min-h-0 w-80 shrink-0 flex-col overflow-y-auto rounded-2xl border border-border">
                  <SectionLabel className="mb-1 mt-3 capitalize">
                    {format(selected, "EEEE d 'de' MMMM", { locale: es })}
                  </SectionLabel>
                  <DayAgenda items={selectedItems} onOpen={setDetail} />
                </div>
              </div>
            )}

            {!isLoading && (activeView === "week" || activeView === "day") && (
              <TimeGrid
                days={gridDays}
                itemsByDay={itemsByDay}
                onOpen={setDetail}
                onCreate={openCreate}
              />
            )}
          </div>
        </AppShellScroll>

        {/* Create flow */}
        <ResponsiveSheet open={open} onOpenChange={setOpen} title="Nuevo evento">
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="e-title">Título</Label>
              <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-start">Fecha y hora</Label>
              <Input
                id="e-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={submit} disabled={create.isPending} variant="ink" size="block">
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Crear
              </Button>
              <Button
                variant="ghost"
                size="block"
                onClick={() => setOpen(false)}
                disabled={create.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </ResponsiveSheet>

        {/* Event detail */}
        <ResponsiveSheet
          open={!!detail}
          onOpenChange={(o) => !o && setDetail(null)}
          title={detail?.title ?? "Sin título"}
          description={
            detail
              ? format(new Date(detail.start_at ?? Date.now()), "EEEE d 'de' MMMM", { locale: es })
              : undefined
          }
        >
          {detail && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Pill tone={TYPE_META[detail.item_type].tone}>
                  {TYPE_META[detail.item_type].label}
                </Pill>
                <span className="text-sm font-medium text-muted-foreground">
                  {detail.all_day || !detail.start_at
                    ? "Todo el día"
                    : `${format(new Date(detail.start_at), "HH:mm")}${
                        detail.end_at ? ` – ${format(new Date(detail.end_at), "HH:mm")}` : ""
                      }`}
                </span>
              </div>
              {detail.status && (
                <div className="text-sm text-muted-foreground">
                  Estado: <span className="text-foreground">{detail.status}</span>
                </div>
              )}
              <Button variant="ghost" size="block" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          )}
        </ResponsiveSheet>
      </PageLayout>

      {canPropo && propoOpen && (
        <AgentOverlay onClose={() => setPropoOpen(false)} initialMode="voice" />
      )}
    </>
  );
}

/** Dashed call-to-action that opens Propo in voice mode. */
function PropoCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-transparent p-3.5 text-left transition active:scale-[0.99]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Sparkles className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Agenda con Propo</span>
        <span className="block text-xs text-muted-foreground">
          Agéndame una visita el sábado y recuérdame revisar los planos
        </span>
      </span>
      <Mic className="size-[19px] shrink-0 text-foreground" strokeWidth={1.9} />
    </button>
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
}: {
  days: Date[];
  cursor: Date;
  selected: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (d: Date) => void;
  onCreate?: (d: Date) => void;
}) {
  return (
    <div className="px-5 lg:px-0">
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
                    ? "bg-foreground text-background"
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
                        : TYPE_META[it.item_type].dot,
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
}: {
  items: CalendarItem[];
  onOpen: (it: CalendarItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
        <CalendarDays className="size-9 text-faint" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden">
      {items.map((it, i) => {
        const meta = TYPE_META[it.item_type];
        return (
          <Row
            key={`${it.item_type}-${it.id}`}
            divider={i < items.length - 1}
            onClick={() => onOpen(it)}
            left={
              <div className="flex w-12 shrink-0 items-center gap-2">
                <span className="h-9 w-1 rounded-full" style={{ background: meta.dot }} />
                <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                  {timeLabel(it)}
                </span>
              </div>
            }
            title={it.title ?? "Sin título"}
            right={<Pill tone={meta.tone}>{meta.label}</Pill>}
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
}: {
  days: Date[];
  itemsByDay: Map<string, CalendarItem[]>;
  onOpen: (it: CalendarItem) => void;
  onCreate: (d: Date) => void;
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
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
                    isToday ? "bg-foreground text-background" : "text-foreground",
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
                        background: `color-mix(in oklab, ${TYPE_META[it.item_type].dot} 18%, transparent)`,
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
                  {/* Timed events */}
                  {timed.map((it) => {
                    const meta = TYPE_META[it.item_type];
                    return (
                      <button
                        key={`${it.item_type}-${it.id}`}
                        type="button"
                        onClick={() => onOpen(it)}
                        className="absolute inset-x-1 overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left"
                        style={{
                          top: (startMinutes(it) / 60) * HOUR_PX,
                          height: durationPx(it),
                          borderColor: meta.dot,
                          background: `color-mix(in oklab, ${meta.dot} 16%, var(--color-card))`,
                        }}
                      >
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {it.title ?? "Sin título"}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {timeLabel(it)}
                        </span>
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

/* ------------------------------------------------------------------ */
/* Mobile calendar (rebuilt to match the reference mockup)            */
/* ------------------------------------------------------------------ */

/** "Hoy" / "Mañana" / capitalized weekday for a day heading. */
function dayHeading(day: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(day, today)) return "Hoy";
  if (isSameDay(day, addDays(today, 1))) return "Mañana";
  const w = format(day, "EEEE", { locale: es });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Full-width Día / Semana / Mes pill switch (active = filled ink). */
function MobileViewSwitch({
  value,
  onChange,
}: {
  value: MobileView;
  onChange: (v: MobileView) => void;
}) {
  return (
    <div className="flex gap-2 px-5 pb-4">
      {MOBILE_VIEW_ITEMS.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-semibold transition active:scale-[0.98]",
              active
                ? "bg-foreground text-background"
                : "border border-line-strong text-foreground hover:bg-secondary",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal week day-strip: weekday letter + day number + event dot. */
function WeekStrip({
  days,
  selected,
  itemsByDay,
  onSelect,
}: {
  days: Date[];
  selected: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (d: Date) => void;
}) {
  return (
    <div className="flex gap-1.5 px-4 pb-4">
      {days.map((day, i) => {
        const isSelected = isSameDay(day, selected);
        const isToday = isSameDay(day, new Date());
        const has = (itemsByDay.get(dayKey(day)) ?? []).length > 0;
        return (
          <button
            key={dayKey(day)}
            type="button"
            onClick={() => onSelect(day)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-[0.97]",
              isSelected ? "bg-foreground" : "hover:bg-secondary",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-semibold",
                isSelected ? "text-background/60" : "text-faint",
              )}
            >
              {WEEKDAYS[i]}
            </span>
            <span
              className={cn(
                "text-base font-bold tabular-nums",
                isSelected ? "text-background" : isToday ? "text-primary" : "text-foreground",
              )}
            >
              {format(day, "d")}
            </span>
            <span
              className="size-1 rounded-full"
              style={{
                background: has
                  ? isSelected
                    ? "var(--color-background)"
                    : "var(--color-accent-brand)"
                  : "transparent",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Rich event row: time + duration, colored bar, kind icon + label, title, meta. */
function EventRow({ item, onOpen }: { item: CalendarItem; onOpen: (it: CalendarItem) => void }) {
  const meta = TYPE_META[item.item_type];
  const KindIcon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full gap-3 px-5 py-3 text-left transition active:scale-[0.99] hover:bg-secondary/50"
    >
      {/* Time + duration */}
      <div className="w-[46px] shrink-0 text-right">
        <div className="text-[15px] font-bold tabular-nums text-foreground">{timeLabel(item)}</div>
        <div className="mt-0.5 text-[11px] text-faint">{durationLabel(item)}</div>
      </div>
      {/* Colored vertical bar */}
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: meta.dot }} />
      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <KindIcon className="size-3.5 shrink-0" strokeWidth={2} style={{ color: meta.dot }} />
          <span
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: meta.dot }}
          >
            {meta.label}
          </span>
        </div>
        <div className="text-[15px] font-semibold leading-snug text-foreground">
          {item.title ?? "Sin título"}
        </div>
        {item.status && (
          <div className="mt-1.5 text-[12.5px] capitalize text-muted-foreground">
            {item.status.toLowerCase()}
          </div>
        )}
      </div>
    </button>
  );
}

/** Empty state for a day/week with no events. */
function MobileEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
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
}: {
  days: Date[];
  selected: Date;
  itemsByDay: Map<string, CalendarItem[]>;
  onSelect: (d: Date) => void;
}) {
  return (
    <div className="px-4 pb-6">
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
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl transition active:scale-[0.95]",
                filled ? "bg-foreground" : "hover:bg-secondary",
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
              <span
                className="size-1.5 rounded-full"
                style={{
                  background:
                    items.length > 0
                      ? filled
                        ? "var(--color-background)"
                        : "var(--color-accent-brand)"
                      : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile calendar orchestrator: view switch + week strip + Día/Semana/Mes body. */
function MobileCalendar({
  mobileView,
  onViewChange,
  selected,
  onSelect,
  weekDays,
  monthDays,
  itemsByDay,
  isLoading,
  onOpen,
  canPropo,
  onOpenPropo,
}: {
  mobileView: MobileView;
  onViewChange: (v: MobileView) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  weekDays: Date[];
  monthDays: Date[];
  itemsByDay: Map<string, CalendarItem[]>;
  isLoading: boolean;
  onOpen: (it: CalendarItem) => void;
  canPropo: boolean;
  onOpenPropo: () => void;
}) {
  // Tapping a month-grid day selects it and drops back into the Día view.
  const selectFromMonth = (d: Date) => {
    onSelect(d);
    onViewChange("day");
  };

  const selectedItems = itemsByDay.get(dayKey(selected)) ?? [];

  return (
    <div className="pb-6">
      <MobileViewSwitch value={mobileView} onChange={onViewChange} />

      {mobileView !== "month" && (
        <WeekStrip
          days={weekDays}
          selected={selected}
          itemsByDay={itemsByDay}
          onSelect={onSelect}
        />
      )}

      {canPropo && (
        <div className="px-5 pb-4">
          <PropoCard onOpen={onOpenPropo} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : mobileView === "day" ? (
        <div>
          <div className="flex items-baseline gap-2 px-5 pb-2 pt-1">
            <span className="text-lg font-bold tracking-tight text-foreground">
              {dayHeading(selected)}
            </span>
            <span className="text-[13px] text-faint">
              {format(selected, "d 'de' MMMM", { locale: es })}
            </span>
          </div>
          {selectedItems.length ? (
            selectedItems.map((it) => (
              <EventRow key={`${it.item_type}-${it.id}`} item={it} onOpen={onOpen} />
            ))
          ) : (
            <MobileEmpty label="Sin eventos este día." />
          )}
        </div>
      ) : mobileView === "week" ? (
        <div>
          {weekDays.some((d) => (itemsByDay.get(dayKey(d)) ?? []).length > 0) ? (
            weekDays.map((day) => {
              const items = itemsByDay.get(dayKey(day)) ?? [];
              if (!items.length) return null;
              return (
                <div key={dayKey(day)} className="mb-1">
                  <div className="flex items-baseline gap-2 px-5 pb-1 pt-3">
                    <span className="text-base font-bold tracking-tight text-foreground">
                      {dayHeading(day)}
                    </span>
                    <span className="text-[13px] text-faint">
                      {format(day, "EEE d MMM", { locale: es })}
                    </span>
                  </div>
                  {items.map((it) => (
                    <EventRow key={`${it.item_type}-${it.id}`} item={it} onOpen={onOpen} />
                  ))}
                </div>
              );
            })
          ) : (
            <MobileEmpty label="Sin eventos esta semana." />
          )}
        </div>
      ) : (
        <MobileMonthGrid
          days={monthDays}
          selected={selected}
          itemsByDay={itemsByDay}
          onSelect={selectFromMonth}
        />
      )}
    </div>
  );
}
