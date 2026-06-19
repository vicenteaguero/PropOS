import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
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
import { BottomSheet, Pill, Row, RoundButton, SectionLabel } from "@shared/ui";
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

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const { data, isLoading, error, refetch } = useCalendarFeed(
    gridStart.toISOString(),
    gridEnd.toISOString(),
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

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedItems = itemsByDay.get(selectedKey) ?? [];

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
    <PageLayout width="md" noPadding>
      <div className="px-5 pt-4 pb-4">
        <PageHeader
          title="Calendario"
          description="Visitas, vencimientos y pagos del equipo."
          className="mb-0"
          actions={
            <Button onClick={() => setOpen(true)} variant="ink" className="gap-2">
              <Plus className="size-4" strokeWidth={1.8} />
              Nuevo evento
            </Button>
          }
        />
      </div>

      <div className="flex items-center justify-between px-5 pb-3">
        <h2 className="text-xl font-bold capitalize tracking-tight text-foreground">
          {format(cursor, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1.5">
          <RoundButton onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Mes anterior">
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </RoundButton>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => {
              const today = new Date();
              setCursor(today);
              setSelected(today);
            }}
          >
            Hoy
          </Button>
          <RoundButton onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Mes siguiente">
            <ChevronRight className="size-5" strokeWidth={1.8} />
          </RoundButton>
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo cargar el calendario.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="px-5">
        <div className="grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="pb-1 text-center text-xs font-semibold text-faint">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = itemsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selected);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
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
          {selectedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CalendarDays className="size-9 text-faint" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Sin eventos este día.</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              {selectedItems.map((it, i) => {
                const meta = TYPE_META[it.item_type];
                return (
                  <Row
                    key={`${it.item_type}-${it.id}`}
                    divider={i < selectedItems.length - 1}
                    left={
                      <div className="flex w-12 shrink-0 items-center gap-2">
                        <span
                          className="h-9 w-1 rounded-full"
                          style={{ background: meta.dot }}
                        />
                        <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                          {it.all_day || !it.start_at
                            ? "Todo"
                            : format(new Date(it.start_at), "HH:mm")}
                        </span>
                      </div>
                    }
                    title={it.title ?? "Sin título"}
                    right={<Pill tone={meta.tone}>{meta.label}</Pill>}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      <BottomSheet open={open} onOpenChange={setOpen} title="Nuevo evento">
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
      </BottomSheet>
    </PageLayout>
  );
}
