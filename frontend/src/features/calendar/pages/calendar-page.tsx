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
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { toast } from "sonner";
import { useCalendarFeed, useCreateEvent } from "../hooks/use-calendar";
import type { CalendarItem } from "../api/calendar-api";

const TYPE_COLOR: Record<string, string> = {
  EVENT: "bg-primary/20 text-primary",
  TASK: "bg-amber-500/20 text-amber-500",
  PAYMENT: "bg-emerald-500/20 text-emerald-500",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
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
    return m;
  }, [data]);

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
    <PageLayout width="xl">
      <PageHeader
        title="Calendario"
        description="Visitas, vencimientos y pagos del equipo."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Nuevo evento
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold capitalize">
          {format(cursor, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo cargar el calendario.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-card px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = itemsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-24 bg-card p-1.5 ${isSameMonth(day, cursor) ? "" : "opacity-40"} ${
                isSameDay(day, new Date()) ? "ring-1 ring-inset ring-primary" : ""
              }`}
            >
              <div className="mb-1 text-xs text-muted-foreground">{format(day, "d")}</div>
              <div className="space-y-1">
                {items.slice(0, 4).map((it) => (
                  <div
                    key={`${it.item_type}-${it.id}`}
                    className={`truncate rounded px-1 py-0.5 text-[11px] ${TYPE_COLOR[it.item_type] ?? "bg-muted"}`}
                    title={it.title ?? ""}
                  >
                    {it.title}
                  </div>
                ))}
                {items.length > 4 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 4} más</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-4 flex justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending} className="gap-2">
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
