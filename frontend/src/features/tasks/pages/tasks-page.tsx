import { useMemo, useState } from "react";
import {
  addDays,
  endOfWeek,
  format,
  isPast,
  isThisWeek,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Flag, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  Chip,
  Chips,
  ErrorState,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  Row,
  RoundButton,
  SectionLabel,
} from "@shared/ui";
import { toast } from "sonner";
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "../hooks/use-tasks";
import { useCreateReminder } from "../hooks/use-reminders";
import { TaskEntityPicker, linkToRelated, type TaskLink } from "../components/task-entity-picker";
import type { Task } from "../api/tasks-api";

/* ------------------------------------------------------------------ *
 * Desktop bucket model (unchanged) — two-column near/later split.
 * ------------------------------------------------------------------ */

type Bucket = "Hoy" | "Esta semana" | "Más adelante" | "Sin fecha";

/** Desktop split: near-term buckets on the left, later ones on the right. */
const LEFT_BUCKETS: Bucket[] = ["Hoy", "Esta semana"];
const RIGHT_BUCKETS: Bucket[] = ["Más adelante", "Sin fecha"];

function bucketOf(t: Task): Bucket {
  if (!t.due_at) return "Sin fecha";
  const d = new Date(t.due_at);
  if (isToday(d)) return "Hoy";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "Esta semana";
  return "Más adelante";
}

const ORDER: Bucket[] = ["Hoy", "Esta semana", "Más adelante", "Sin fecha"];

const FILTERS: { id: "all" | Bucket; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "Hoy", label: "Hoy" },
  { id: "Esta semana", label: "Esta semana" },
  { id: "Más adelante", label: "Más adelante" },
  { id: "Sin fecha", label: "Sin fecha" },
];

/** Form priority choices — same scale the list renders through `priorityPill`. */
const PRIORITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Normal" },
  { value: 1, label: "Media" },
  { value: 2, label: "Alta" },
];

/** Priority pill: backend orders desc, higher = more urgent. 0 → none. */
function priorityPill(priority: number) {
  if (priority >= 2) return <Pill tone="destructive">Alta</Pill>;
  if (priority === 1) return <Pill tone="warning">Media</Pill>;
  return null;
}

function dueLabel(due: string): { text: string; tone: "neutral" | "warning" } {
  const d = new Date(due);
  const text = d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  return { text, tone: isPast(d) && !isToday(d) ? "warning" : "neutral" };
}

/** One bucket: heading + its task rows. Desktop only. */
function BucketSection({
  bucket,
  tasks,
  onComplete,
  onDelete,
}: {
  bucket: Bucket;
  tasks: Task[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <SectionLabel className="mb-2">{bucket}</SectionLabel>
      <div className="overflow-hidden">
        {tasks.map((t, i) => {
          const due = t.due_at ? dueLabel(t.due_at) : null;
          return (
            <Row
              key={t.id}
              divider={i < tasks.length - 1}
              left={
                <button
                  type="button"
                  onClick={() => onComplete(t.id)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-transparent transition-colors hover:border-success hover:text-success"
                  aria-label="Completar"
                />
              }
              title={t.title}
              sub={
                due || priorityPill(t.priority) ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {due && <Pill tone={due.tone}>{due.text}</Pill>}
                    {priorityPill(t.priority)}
                  </span>
                ) : undefined
              }
              right={
                <RoundButton
                  tone="ghost"
                  size={32}
                  onClick={() => onDelete(t.id)}
                  aria-label="Eliminar"
                  className="text-muted-foreground"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </RoundButton>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Mobile period model — Todoist × Uber time view.
 * ------------------------------------------------------------------ */

/** Urgency of a single task — drives the checkbox ring + due-label color. */
type Urgency = "overdue" | "today" | "tomorrow" | "week" | "nextweek" | "nodate";

/** Period bucket a task lands in (overdue is folded into "today"). */
type Period = "today" | "tomorrow" | "week" | "nextweek" | "nodate";

const PERIOD_META: { id: Period; label: string; title: string }[] = [
  { id: "today", label: "Hoy", title: "Hoy" },
  { id: "tomorrow", label: "Mañana", title: "Mañana" },
  { id: "week", label: "Esta semana", title: "Esta semana" },
  { id: "nextweek", label: "Próxima", title: "Próxima semana" },
  { id: "nodate", label: "Sin fecha", title: "Sin fecha" },
];

/** Inline color for the checkbox ring + calendar icon, keyed by urgency. */
const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "var(--color-destructive)",
  today: "var(--color-success)",
  tomorrow: "var(--color-warning)",
  week: "var(--color-accent-brand)",
  nextweek: "var(--color-accent-brand)",
  nodate: "var(--color-line-strong)",
};

/** Classify a task's due date into an urgency bracket. */
function urgencyOf(t: Task): Urgency {
  if (!t.due_at) return "nodate";
  const d = new Date(t.due_at);
  if (isToday(d)) return "today";
  if (isPast(d)) return "overdue";
  if (isTomorrow(d)) return "tomorrow";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "week";
  // Within the following calendar week (Mon-start) counts as "next week".
  if (isThisWeek(addDays(d, -7), { weekStartsOn: 1 })) return "nextweek";
  // Anything further out still surfaces under the "next week" / later chip.
  return "nextweek";
}

/** Period a task belongs to in the chip view (overdue folds into "today"). */
function periodOf(t: Task): Period {
  const u = urgencyOf(t);
  if (u === "overdue") return "today";
  return u as Period;
}

/** Short human due label, e.g. "Hoy 14:30", "mar 24 jun", "Mañana". */
function shortDueLabel(t: Task): string {
  if (!t.due_at) return "Sin fecha";
  const d = new Date(t.due_at);
  const time = format(d, "HH:mm");
  const hasTime = time !== "00:00";
  if (isToday(d)) return hasTime ? `Hoy ${time}` : "Hoy";
  if (isTomorrow(d)) return hasTime ? `Mañana ${time}` : "Mañana";
  const day = format(d, "EEE d MMM", { locale: es });
  return hasTime ? `${day} ${time}` : day;
}

/** Subtitle under a period title, e.g. "mié 21 jun" or "22 – 28 jun". */
function periodSubtitle(period: Period): string | null {
  const today = startOfDay(new Date());
  switch (period) {
    case "today":
      return format(today, "EEE d MMM", { locale: es });
    case "tomorrow":
      return format(addDays(today, 1), "EEE d MMM", { locale: es });
    case "week": {
      const from = addDays(today, 2);
      const to = endOfWeek(today, { weekStartsOn: 1 });
      if (to < from) return null;
      return `${format(from, "d", { locale: es })} – ${format(to, "d MMM", { locale: es })}`;
    }
    case "nextweek":
      return "Más adelante";
    default:
      return null;
  }
}

/** Circular check button. Open = colored ring; done = filled ink + white check. */
function TaskCheck({
  done,
  color,
  onToggle,
}: {
  done: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Completar"
      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full transition active:scale-90"
      style={
        done
          ? { width: 22, height: 22, background: "var(--color-foreground)" }
          : { width: 22, height: 22, border: `2px solid ${color}` }
      }
    >
      {done && (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--color-background)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/** Rich mobile task row: check + title + colored due/priority meta line. */
function MobileTaskRow({
  t,
  done,
  divider,
  onComplete,
  onDelete,
}: {
  t: Task;
  done: boolean;
  divider: boolean;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const urgency = urgencyOf(t);
  const ringColor = !done && t.priority >= 2 ? URGENCY_COLOR.overdue : URGENCY_COLOR[urgency];
  const dueColor = URGENCY_COLOR[urgency];
  const highPriority = t.priority >= 2;

  return (
    <div className={`flex items-start gap-3 px-5 py-3 ${divider ? "border-b border-border" : ""}`}>
      <TaskCheck done={done} color={ringColor} onToggle={() => onComplete(t.id)} />

      <div className="min-w-0 flex-1">
        <div
          className={`text-[15px] font-medium leading-snug ${
            done ? "text-faint line-through" : "text-foreground"
          }`}
        >
          {t.title}
        </div>

        {!done && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: dueColor }}
            >
              <Calendar className="size-3.5" strokeWidth={2} style={{ color: dueColor }} />
              {urgency === "overdue" ? `Atrasada · ${shortDueLabel(t)}` : shortDueLabel(t)}
            </span>
            {highPriority && (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-destructive">
                <Flag className="size-3" strokeWidth={2} />
                P1 · Alta
              </span>
            )}
            {!highPriority && t.priority === 1 && (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-warning">
                <Flag className="size-3" strokeWidth={2} />
                Media
              </span>
            )}
          </div>
        )}
      </div>

      {/* Always visible: this row is the touch surface, and a hover-only
          control is unreachable there. 44px box, pulled into the row padding
          so the icon still reads as a small affordance. */}
      <button
        type="button"
        onClick={() => onDelete(t.id)}
        aria-label="Eliminar"
        className="-mt-1.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-faint transition hover:bg-secondary hover:text-destructive active:scale-90"
      >
        <Trash2 className="size-4" strokeWidth={1.8} />
      </button>
    </div>
  );
}

/** "Añadir tarea" dashed-circle row at the bottom of a period list. */
function AddTaskRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition active:scale-[0.99]"
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed text-faint"
        style={{ width: 22, height: 22, borderColor: "var(--color-line-strong)" }}
      >
        <Plus className="size-3" strokeWidth={2.4} />
      </span>
      <span className="text-[14.5px] font-medium text-muted-foreground">Añadir tarea</span>
    </button>
  );
}

export function TasksPage() {
  const { data, isLoading, error, refetch } = useTasks({ only_open: true });
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const createReminder = useCreateReminder();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [priority, setPriority] = useState(0);
  const [link, setLink] = useState<TaskLink | null>(null);
  // Bumped on reset so the entity picker drops its internal mode + query.
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState<"all" | Bucket>("all");
  const [period, setPeriod] = useState<Period>("today");

  /* Desktop grouping (unchanged). */
  const grouped = useMemo(() => {
    const g = new Map<Bucket, Task[]>();
    for (const t of data ?? []) {
      const b = bucketOf(t);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
    }
    return g;
  }, [data]);

  /* Mobile grouping by period + a separate overdue list (shown under "Hoy"). */
  const { byPeriod, overdue } = useMemo(() => {
    const byPeriod = new Map<Period, Task[]>();
    const overdue: Task[] = [];
    for (const t of data ?? []) {
      if (urgencyOf(t) === "overdue") overdue.push(t);
      const p = periodOf(t);
      if (!byPeriod.has(p)) byPeriod.set(p, []);
      byPeriod.get(p)!.push(t);
    }
    return { byPeriod, overdue };
  }, [data]);

  /** Open-task count per period chip (overdue counts toward "today"). */
  const periodCount = (p: Period) => byPeriod.get(p)?.length ?? 0;

  const visibleBuckets = ORDER.filter((b) => grouped.has(b)).filter(
    (b) => filter === "all" || b === filter,
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueAt("");
    setRemindAt("");
    setPriority(0);
    setLink(null);
    setFormKey((k) => k + 1);
  };

  /** Picking a due date pre-fills the reminder so the task actually notifies. */
  const handleDueChange = (value: string) => {
    if (!remindAt || remindAt === dueAt) setRemindAt(value);
    setDueAt(value);
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Agregá un título");
      return;
    }
    let task;
    try {
      task = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        related: linkToRelated(link),
      });
    } catch {
      // `useCreateTask` already toasts; keep the sheet open so the user retries.
      return;
    }

    // The reminder is a separate row: `TaskCreate` carries no `remind_at`, so
    // without this second call the task never reaches the push dispatcher.
    let reminderFailed = false;
    if (remindAt) {
      try {
        await createReminder.mutateAsync({
          target_table: "tasks",
          target_row_id: task.id,
          remind_at: new Date(remindAt).toISOString(),
          message: task.title,
        });
      } catch {
        reminderFailed = true;
      }
    }

    resetForm();
    setOpen(false);
    if (reminderFailed) {
      toast.warning("Tarea creada, pero no se pudo agendar el recordatorio");
    } else {
      toast.success("Tarea creada");
    }
  };

  /** Both mutations block the form: the task and its reminder land together. */
  const busy = create.isPending || createReminder.isPending;

  const complete = (id: string) => update.mutate({ id, body: { status: "DONE" } });
  const remove = (id: string) => del.mutate(id);

  // Desktop arranges the visible buckets into two columns; mobile uses periods.
  const leftCol = visibleBuckets.filter((b) => LEFT_BUCKETS.includes(b));
  const rightCol = visibleBuckets.filter((b) => RIGHT_BUCKETS.includes(b));

  // Mobile: the tasks for the currently-selected period.
  const periodTasks = byPeriod.get(period) ?? [];
  // Inside "Hoy" we list overdue first, then strictly-today tasks.
  const todayOnly =
    period === "today" ? periodTasks.filter((t) => urgencyOf(t) !== "overdue") : periodTasks;
  const periodTitle = PERIOD_META.find((p) => p.id === period)!.title;
  const subtitle = periodSubtitle(period);

  return (
    // Mobile keeps the capped (md) centered column; desktop widens to the app surface.
    <PageLayout width="app" noPadding className="max-w-4xl lg:max-w-none">
      <div className="px-5 pt-4 pb-5 lg:px-8 lg:pt-7">
        <PageHeader
          title="Tareas"
          description="Pendientes, recordatorios y metas del equipo."
          className="mb-0"
          actions={
            <Button onClick={() => setOpen(true)} variant="ink" className="gap-2">
              <Plus className="size-4" strokeWidth={1.8} />
              Nueva
            </Button>
          }
        />
      </div>

      {isLoading && <PageSkeleton variant="list" count={5} />}
      {error && (
        <ErrorState
          message="No se pudieron cargar las tareas."
          onRetry={() => refetch()}
          className="mx-5 lg:mx-8"
        />
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Sin tareas abiertas"
          description="Creá una tarea o pedísela a la IA por chat."
          actionLabel="Nueva tarea"
          onAction={() => setOpen(true)}
        />
      )}

      {!isLoading && !error && (data?.length ?? 0) > 0 && (
        <>
          {/* ---------------------------------------------------------- *
           * Mobile: Todoist × Uber time view — period chips + section.
           * ---------------------------------------------------------- */}
          <div className="pb-6 lg:hidden">
            <Chips className="px-5 pb-4">
              {PERIOD_META.filter((p) => p.id !== "nodate" || periodCount("nodate") > 0).map(
                (p) => (
                  <Chip
                    key={p.id}
                    active={period === p.id}
                    count={periodCount(p.id) || undefined}
                    onClick={() => setPeriod(p.id)}
                  >
                    {p.label}
                  </Chip>
                ),
              )}
            </Chips>

            {/* Big period title + date-range subtext. */}
            <div className="flex items-baseline gap-2.5 px-5 pb-1.5">
              <h2 className="text-[22px] font-bold tracking-tight text-foreground">
                {periodTitle}
              </h2>
              {subtitle && <span className="text-[13px] text-faint">{subtitle}</span>}
            </div>

            {/* Overdue sub-section, only inside "Hoy". */}
            {period === "today" && overdue.length > 0 && (
              <div className="mb-1">
                <div className="px-5 pt-2.5 pb-1">
                  <span className="text-[13.5px] font-bold text-destructive">Atrasadas</span>
                </div>
                {overdue.map((t, i) => (
                  <MobileTaskRow
                    key={t.id}
                    t={t}
                    done={t.status === "DONE"}
                    divider={i < overdue.length - 1}
                    onComplete={complete}
                    onDelete={remove}
                  />
                ))}
                <div className="h-2" />
              </div>
            )}

            {/* The period's own tasks. */}
            {todayOnly.map((t, i) => (
              <MobileTaskRow
                key={t.id}
                t={t}
                done={t.status === "DONE"}
                divider={i < todayOnly.length - 1}
                onComplete={complete}
                onDelete={remove}
              />
            ))}

            {/* Per-period empty states (overdue still counts for "Hoy"). */}
            {todayOnly.length === 0 && !(period === "today" && overdue.length > 0) && (
              <div className="px-5 py-8 text-center text-sm text-faint">
                {period === "today" ? "Todo al día 🎉" : "Sin tareas · disfruta 🎉"}
              </div>
            )}

            <AddTaskRow onClick={() => setOpen(true)} />
          </div>

          {/* ---------------------------------------------------------- *
           * Desktop: two columns — near-term left, later right. (unchanged)
           * ---------------------------------------------------------- */}
          <Chips className="hidden px-8 pb-5 lg:flex">
            {FILTERS.filter((f) => f.id === "all" || grouped.has(f.id)).map((f) => (
              <Chip
                key={f.id}
                active={filter === f.id}
                count={f.id === "all" ? (data?.length ?? 0) : grouped.get(f.id)?.length}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Chip>
            ))}
          </Chips>

          <div className="hidden gap-x-8 px-8 pb-6 lg:grid lg:grid-cols-2">
            <div className="space-y-7">
              {leftCol.map((bucket) => (
                <BucketSection
                  key={bucket}
                  bucket={bucket}
                  tasks={grouped.get(bucket)!}
                  onComplete={complete}
                  onDelete={remove}
                />
              ))}
            </div>
            <div className="space-y-7">
              {rightCol.map((bucket) => (
                <BucketSection
                  key={bucket}
                  bucket={bucket}
                  tasks={grouped.get(bucket)!}
                  onComplete={complete}
                  onDelete={remove}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nueva tarea"
        className="max-h-[88dvh] overflow-y-auto"
      >
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Detalle (opcional)</Label>
            <Textarea
              id="t-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-due">Vence (opcional)</Label>
            <Input
              id="t-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => handleDueChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-remind">Recordatorio (opcional)</Label>
            <Input
              id="t-remind"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
            <p className="text-[12px] text-muted-foreground">
              Te avisamos con una notificación push a esa hora.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Chips className="pb-0">
              {PRIORITY_OPTIONS.map((p) => (
                <Chip
                  key={p.value}
                  active={priority === p.value}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </Chip>
              ))}
            </Chips>
          </div>
          <div className="space-y-1.5">
            <Label>Vincular a</Label>
            <TaskEntityPicker key={formKey} value={link} onChange={setLink} disabled={busy} />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={submit} disabled={busy} variant="ink" size="block">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
            <Button variant="ghost" size="block" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      </ResponsiveSheet>
    </PageLayout>
  );
}
