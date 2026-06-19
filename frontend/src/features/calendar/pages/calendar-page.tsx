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
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
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
import { useCalendarFeed, useCreateEvent } from "../hooks/use-calendar";
import type { CalendarItem } from "../api/calendar-api";
import type { PillTone } from "@shared/ui";

/** Per-type tone + dot color (semantic tokens only). */
const TYPE_META: Record<CalendarItem["item_type"], { tone: PillTone; dot: string; label: string }> =
  {
    EVENT: { tone: "accent", dot: "var(--color-accent-brand)", label: "Evento" },
    TASK: { tone: "warning", dot: "var(--color-warning)", label: "Tarea" },
    PAYMENT: { tone: "success", dot: "var(--color-success)", label: "Pago" },
  };

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

type View = "month" | "week" | "day";

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
  const isDesktop = useIsDesktop();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [detail, setDetail] = useState<CalendarItem | null>(null);

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

  // Mobile is locked to the month grid regardless of the (desktop-only) toggle.
  const activeView: View = isDesktop ? view : "month";

  // Visible range drives both the query window and what we render.
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

  const { data, isLoading, error, refetch } = useCalendarFeed(
    rangeStart.toISOString(),
    rangeEnd.toISOString(),
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

  // Period label adapts to the active view.
  const periodLabel = useMemo(() => {
    if (activeView === "day") return format(cursor, "EEEE d 'de' MMMM", { locale: es });
    if (activeView === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return isSameMonth(s, e)
        ? `${format(s, "d", { locale: es })}–${format(e, "d 'de' MMMM", { locale: es })}`
        : `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`;
    }
    return format(cursor, "MMMM yyyy", { locale: es });
  }, [activeView, cursor]);

  const step = (dir: 1 | -1) => {
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
    // Mobile keeps the capped (md) centered column; desktop goes full-bleed.
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

        {/* Body. Mobile: month grid + day agenda (unchanged). Desktop: per-view. */}
        {/* ---- Mobile (always month) ---- */}
        <div className="lg:hidden">
          <MonthGrid
            days={gridDays}
            cursor={cursor}
            selected={selected}
            itemsByDay={itemsByDay}
            onSelect={setSelected}
          />

          {isLoading && (
            <div className="mt-6 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (
            <div className="mt-6 pb-6">
              <SectionLabel className="mb-2 capitalize">
                {format(selected, "EEEE d 'de' MMMM", { locale: es })}
              </SectionLabel>
              <DayAgenda items={selectedItems} onOpen={setDetail} />
            </div>
          )}
        </div>

        {/* ---- Desktop ---- */}
        <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col">
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
                  onSelect={setSelected}
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
