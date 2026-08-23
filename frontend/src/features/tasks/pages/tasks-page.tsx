import { useMemo, useState } from "react";
import { formatDateTime, initials } from "@shared/utils/format";
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
import { Calendar, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@shared/components/page-layout";
import { createPortal } from "react-dom";
import { useTopbarActionsSlot } from "@layouts/topbar-slot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTenantMembers } from "@shared/hooks/use-tenant-members";
import { TaskDetailSheet } from "../components/task-detail-sheet";
import {
  matchesPriority,
  sortTasks,
  type TaskOrder,
  type TaskPriorityFilter,
} from "../lib/task-order";
import { type Period, type TaskScope } from "../lib/task-periods";
import { TaskControls } from "../components/task-controls";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  ActionIcon,
  Chip,
  Chips,
  ErrorState,
  FilterSelect,
  LinkInput,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  Row,
  SectionLabel,
  SheetActions,
  TOUCH_TARGET_HIT_AREA,
  CONTROL_H,
} from "@shared/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@shared/hooks/use-auth";
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

/** Minutes before the due date. Same ladder the event sheet offers. */
const TASK_REMINDER_OFFSETS: { value: number; label: string }[] = [
  { value: 15, label: "15 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 24 * 60, label: "1 día antes" },
];

/** Priority pill: backend orders desc, higher = more urgent. 0 → none. */
function priorityPill(priority: number) {
  if (priority >= 2) return <Pill tone="destructive">Alta</Pill>;
  if (priority === 1) return <Pill tone="warning">Media</Pill>;
  return null;
}

function dueLabel(due: string): { text: string; tone: "neutral" | "warning" } {
  const d = new Date(due);
  // The shared formatter, so a due date reads the same here as everywhere
  // else — `timeStyle: "short"` gave this one screen a 12-hour clock.
  const text = formatDateTime(d);
  return { text, tone: isPast(d) && !isToday(d) ? "warning" : "neutral" };
}

/** One bucket: heading + its task rows. Desktop only. */
function BucketSection({
  bucket,
  tasks,
  onComplete,
  onOpen,
  assigneeFor,
}: {
  bucket: Bucket;
  tasks: Task[];
  onComplete: (id: string) => void;
  onOpen: (t: Task) => void;
  /** Only in team mode; in "mine" every row would carry the same face. */
  assigneeFor?: (t: Task) => { full_name: string | null; avatar_url: string | null } | null;
}) {
  return (
    <section>
      <SectionLabel className="mb-2 px-[var(--page-x)] lg:px-0">{bucket}</SectionLabel>
      <div className="overflow-hidden">
        {tasks.map((t, i) => {
          const due = t.due_at ? dueLabel(t.due_at) : null;
          const assignee = assigneeFor?.(t) ?? null;
          const done = t.status === "DONE";
          return (
            <Row
              key={t.id}
              divider={i < tasks.length - 1}
              onClick={() => onOpen(t)}
              left={
                <button
                  type="button"
                  onClick={(e) => {
                    // The row opens the task; the circle completes it.
                    e.stopPropagation();
                    onComplete(t.id);
                  }}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    done
                      ? "border-foreground bg-ink text-ink-foreground"
                      : "border-line-strong text-transparent hover:border-success hover:text-success",
                    TOUCH_TARGET_HIT_AREA,
                  )}
                  aria-label={done ? "Reabrir" : "Completar"}
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
                assignee ? (
                  <Avatar size="sm" className="size-7" title={assignee.full_name ?? undefined}>
                    {assignee.avatar_url && <AvatarImage src={assignee.avatar_url} alt="" />}
                    <AvatarFallback className="text-[10px]">
                      {initials(assignee.full_name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                ) : undefined
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
      // Centred on the row rather than pinned to the first text line, and with
      // the hit area expanded to the 44px floor: the painted circle is 22px, so
      // half of every tap was landing on the row instead of the control.
      className={cn(
        "flex shrink-0 items-center justify-center self-center rounded-full transition active:scale-90",
        TOUCH_TARGET_HIT_AREA,
      )}
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
  onOpen,
  assignee,
}: {
  t: Task;
  done: boolean;
  divider: boolean;
  onComplete: (id: string) => void;
  onOpen: (t: Task) => void;
  /** Only passed in team mode: in "mine" every row would carry the same face. */
  assignee?: { full_name: string | null; avatar_url: string | null } | null;
}) {
  const urgency = urgencyOf(t);
  const ringColor = !done && t.priority >= 2 ? URGENCY_COLOR.overdue : URGENCY_COLOR[urgency];
  const dueColor = URGENCY_COLOR[urgency];
  const highPriority = t.priority >= 2;

  return (
    <div
      className={`flex items-center gap-3 px-[var(--page-x)] py-3 ${divider ? "border-b border-border" : ""}`}
    >
      <TaskCheck done={done} color={ringColor} onToggle={() => onComplete(t.id)} />

      {/* The row opens the task. Deleting used to live out here, one mis-tap
          from destroying it; it is inside the sheet now, behind a confirm. */}
      <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
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
      </button>

      {assignee && (
        <Avatar size="sm" className="size-7 shrink-0" title={assignee.full_name ?? undefined}>
          {assignee.avatar_url && <AvatarImage src={assignee.avatar_url} alt="" />}
          <AvatarFallback className="text-[10px]">
            {initials(assignee.full_name ?? "?")}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

/** "Añadir tarea" dashed-circle row at the bottom of a period list. */
function AddTaskRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-[var(--page-x)] py-3 text-left transition active:scale-[0.99]"
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed text-faint"
        style={{ width: 22, height: 22, borderColor: "var(--color-line-strong)" }}
      >
        <ActionIcon name="createTask" size="sm" />
      </span>
      <span className="text-[14.5px] font-medium text-muted-foreground">Añadir tarea</span>
    </button>
  );
}

export function TasksPage() {
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  // "Mías" or the whole workspace. `tasks.owner_user` existed but nothing ever
  // wrote or filtered on it, so everyone saw everything with no way to say
  // whose it was.
  const [scope, setScope] = useState<TaskScope>("mine");
  const { data: members } = useTenantMembers();
  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);
  const { data, isLoading, error, refetch } = useTasks({ only_open: true });
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [order, setOrder] = useState<TaskOrder>("due");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityFilter>("all");
  // A task ticked off should leave the flow, not vanish mid-thought. The list
  // only asks for open tasks, so the ones completed in this sitting are kept
  // here and rendered at the end of their group until the next load.
  const [justDone, setJustDone] = useState<Record<string, Task>>({});
  const actionsHost = useTopbarActionsSlot();

  /**
   * "Mías" means mine *or* unclaimed.
   *
   * `owner_user` has never been written until now, so every task that already
   * exists has none. Reading "mine" strictly would hand the user an empty
   * screen and look broken; an unassigned task is nobody's and therefore
   * everybody's, which is also how it behaves in practice.
   */
  const scoped = useMemo(() => {
    if (!data) return data;
    const byScope =
      scope === "team" ? data : data.filter((t) => !t.owner_user || t.owner_user === user?.id);
    return byScope.filter((t) => matchesPriority(t, priorityFilter));
  }, [data, scope, user?.id, priorityFilter]);
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const createReminder = useCreateReminder();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  // Minutes before the due date, not an absolute time: moving the due date
  // used to leave the reminder ringing on the old one.
  const [remindOffset, setRemindOffset] = useState<number | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);
  const [link, setLink] = useState<TaskLink | null>(null);
  // Bumped on reset so the entity picker drops its internal mode + query.
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState<"all" | Bucket>("all");
  const [period, setPeriod] = useState<Period>("today");

  /* Desktop grouping (unchanged). */
  const grouped = useMemo(() => {
    const g = new Map<Bucket, Task[]>();
    for (const t of scoped ?? []) {
      const b = bucketOf(t);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
    }
    return g;
  }, [scoped]);

  /* Mobile grouping by period + a separate overdue list (shown under "Hoy"). */
  const { byPeriod, overdue } = useMemo(() => {
    const byPeriod = new Map<Period, Task[]>();
    const overdue: Task[] = [];
    for (const t of scoped ?? []) {
      if (urgencyOf(t) === "overdue") overdue.push(t);
      const p = periodOf(t);
      if (!byPeriod.has(p)) byPeriod.set(p, []);
      byPeriod.get(p)!.push(t);
    }
    return { byPeriod, overdue };
  }, [scoped]);

  /** Open-task count per period chip (overdue counts toward "today"). */
  const periodCount = (p: Period) => byPeriod.get(p)?.length ?? 0;

  const visibleBuckets = ORDER.filter((b) => grouped.has(b)).filter(
    (b) => filter === "all" || b === filter,
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueAt("");
    setRemindOffset(null);
    setPriority(0);
    setLink(null);
    setLinks([]);
    setFormKey((k) => k + 1);
  };

  /** Setting a due date turns the reminder on, since that is what it is for. */
  const handleDueChange = (value: string) => {
    if (value && remindOffset === null) setRemindOffset(60);
    setDueAt(value);
  };

  /** The reminder, resolved against whatever the due date currently is. */
  const remindAtIso = (): string | null =>
    !dueAt || remindOffset === null
      ? null
      : new Date(new Date(dueAt).getTime() - remindOffset * 60_000).toISOString();

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Agrega un título");
      return;
    }
    let task;
    try {
      task = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        related: { ...(linkToRelated(link) ?? {}), ...(links.length ? { links } : {}) },
        // Claim it. Without an owner a new task is invisible to the "Mías"
        // filter that just shipped, and reassigning is one tap in the sheet.
        owner_user: user?.id ?? null,
      });
    } catch {
      // `useCreateTask` already toasts; keep the sheet open so the user retries.
      return;
    }

    // The reminder is a separate row: `TaskCreate` carries no `remind_at`, so
    // without this second call the task never reaches the push dispatcher.
    let reminderFailed = false;
    const remindAt = remindAtIso();
    if (remindAt) {
      try {
        await createReminder.mutateAsync({
          target_table: "tasks",
          target_row_id: task.id,
          remind_at: remindAt,
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

  const complete = (id: string) => {
    const task = (scoped ?? []).find((t) => t.id === id);
    if (task) setJustDone((prev) => ({ ...prev, [id]: { ...task, status: "DONE" } }));
    update.mutate({ id, body: { status: "DONE" } });
  };
  const remove = (id: string) => del.mutate(id);
  const saveTask = (id: string, body: Partial<Task>) => {
    update.mutate({ id, body });
    setDetailTask(null);
  };

  // Desktop arranges the visible buckets into two columns; mobile uses periods.
  const leftCol = visibleBuckets.filter((b) => LEFT_BUCKETS.includes(b));
  const rightCol = visibleBuckets.filter((b) => RIGHT_BUCKETS.includes(b));

  // Mobile: the tasks for the currently-selected period.
  const periodTasks = byPeriod.get(period) ?? [];
  // Inside "Hoy" we list overdue first, then strictly-today tasks.
  const openInPeriod =
    period === "today" ? periodTasks.filter((t) => urgencyOf(t) !== "overdue") : periodTasks;
  // Ticked-off tasks fall to the bottom of their own group instead of
  // disappearing under the thumb that ticked them.
  const doneInPeriod = Object.values(justDone).filter(
    (t) => periodOf(t) === period && !periodTasks.some((p) => p.id === t.id),
  );
  const todayOnly = sortTasks([...openInPeriod, ...doneInPeriod], order);
  const subtitle = periodSubtitle(period);

  return (
    // Mobile keeps the capped (md) centered column; desktop widens to the app surface.
    <PageLayout width="app" noPadding className="max-w-4xl lg:max-w-none">
      {/* On a phone the create action goes in the bar, where every other list
          in the app keeps it. The sidebar shell has no bar to portal into, so
          the header keeps its own button there. */}
      {actionsHost
        ? createPortal(
            <Button
              onClick={() => setOpen(true)}
              variant="ink"
              size="icon"
              aria-label="Nueva tarea"
              className="rounded-full"
            >
              <ActionIcon name="createTask" />
            </Button>,
            actionsHost,
          )
        : null}

      {isLoading && <PageSkeleton variant="list" count={5} />}
      {error && (
        <ErrorState
          message="No se pudieron cargar las tareas."
          onRetry={() => refetch()}
          className="mx-5 lg:mx-8"
        />
      )}
      {!isLoading && !error && (scoped?.length ?? 0) === 0 && (
        <EmptyState
          title="Sin tareas abiertas"
          actionLabel="Nueva tarea"
          onAction={() => setOpen(true)}
        />
      )}

      {!isLoading && !error && (scoped?.length ?? 0) > 0 && (
        <>
          {/* ---------------------------------------------------------- *
           * Mobile: Todoist × Uber time view — period chips + section.
           * ---------------------------------------------------------- */}
          <div className="pb-6 lg:hidden">
            <TaskControls
              scope={scope}
              onScope={setScope}
              period={period}
              onPeriod={setPeriod}
              periodCount={periodCount}
              priority={priorityFilter}
              onPriority={setPriorityFilter}
              order={order}
              onOrder={setOrder}
              className="px-[var(--page-x)] pb-2.5 pt-1"
            />

            {/* Only the date range. The period's NAME is on the segmented
                control directly above, and a 22px heading repeating it cost a
                whole row to say the word you had just tapped. */}
            {subtitle && (
              <div className="px-[var(--page-x)] pb-1.5">
                <span className="text-[13px] text-faint">{subtitle}</span>
              </div>
            )}

            {/* Overdue sub-section, only inside "Hoy". */}
            {period === "today" && overdue.length > 0 && (
              <div className="mb-1">
                <div className="px-[var(--page-x)] pb-1 pt-2.5">
                  <span className="text-[13.5px] font-bold text-destructive">Atrasadas</span>
                </div>
                {overdue.map((t, i) => (
                  <MobileTaskRow
                    key={t.id}
                    t={t}
                    done={t.status === "DONE"}
                    divider={i < overdue.length - 1}
                    onComplete={complete}
                    onOpen={setDetailTask}
                    assignee={
                      scope === "team" ? (memberById.get(t.owner_user ?? "") ?? null) : null
                    }
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
                onOpen={setDetailTask}
                assignee={scope === "team" ? (memberById.get(t.owner_user ?? "") ?? null) : null}
              />
            ))}

            {/* Per-period empty states (overdue still counts for "Hoy"). */}
            {todayOnly.length === 0 && !(period === "today" && overdue.length > 0) && (
              <div className="px-[var(--page-x)] py-8 text-center text-sm text-faint">
                {period === "today" ? "Todo al día 🎉" : "Sin tareas · disfruta 🎉"}
              </div>
            )}

            <AddTaskRow onClick={() => setOpen(true)} />
          </div>

          {/* ---------------------------------------------------------- *
           * Desktop: two columns — near-term left, later right. (unchanged)
           * ---------------------------------------------------------- */}
          {/* The same component the phone renders — not a second, wordier copy.
              The laptop used to carry `FilterSelect`s spelling out "Prioridad:
              Todas · Ordenar: Vencimiento" beside a chip strip, which is the
              screen with the most room showing the least usable version. */}
          <div className="hidden flex-col gap-2 px-8 pb-5 lg:flex">
            <TaskControls
              scope={scope}
              onScope={setScope}
              period={period}
              onPeriod={setPeriod}
              periodCount={periodCount}
              priority={priorityFilter}
              onPriority={setPriorityFilter}
              order={order}
              onOrder={setOrder}
            />
            <div className="flex items-center gap-2">
              <Chips className="min-w-0 flex-1">
                {FILTERS.filter((f) => f.id === "all" || grouped.has(f.id)).map((f) => (
                  <Chip
                    key={f.id}
                    active={filter === f.id}
                    count={f.id === "all" ? (scoped?.length ?? 0) : grouped.get(f.id)?.length}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </Chip>
                ))}
              </Chips>
              {!actionsHost && (
                <Button
                  onClick={() => setOpen(true)}
                  variant="ink"
                  className={cn("shrink-0 gap-2", CONTROL_H)}
                >
                  <ActionIcon name="createTask" />
                  Nueva
                </Button>
              )}
            </div>
          </div>

          <div className="hidden gap-x-8 px-8 pb-6 lg:grid lg:grid-cols-2">
            <div className="space-y-7">
              {leftCol.map((bucket) => (
                <BucketSection
                  key={bucket}
                  bucket={bucket}
                  tasks={sortTasks(grouped.get(bucket)!, order)}
                  onComplete={complete}
                  onOpen={setDetailTask}
                  assigneeFor={
                    scope === "team" ? (t) => memberById.get(t.owner_user ?? "") ?? null : undefined
                  }
                />
              ))}
            </div>
            <div className="space-y-7">
              {rightCol.map((bucket) => (
                <BucketSection
                  key={bucket}
                  bucket={bucket}
                  tasks={sortTasks(grouped.get(bucket)!, order)}
                  onComplete={complete}
                  onOpen={setDetailTask}
                  assigneeFor={
                    scope === "team" ? (t) => memberById.get(t.owner_user ?? "") ?? null : undefined
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

      <TaskDetailSheet
        task={detailTask}
        role={role}
        onOpenChange={(o) => !o && setDetailTask(null)}
        onSave={saveTask}
        onDelete={remove}
        saving={update.isPending}
      />

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Nueva tarea"
        className="max-h-[88dvh] overflow-y-auto"
      >
        <div className="mt-4 space-y-3">
          {/* Placeholders, not a label above every field — the same language as
              the event sheet, which this used to disagree with on every axis. */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            aria-label="Título"
            className="text-[15px] font-semibold"
          />

          {/* Two controls that belong together, on one row. */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              aria-label="Vence"
              value={dueAt}
              onChange={(e) => handleDueChange(e.target.value)}
              className="min-w-0"
            />
            <FilterSelect
              label="Prioridad"
              value={String(priority)}
              options={PRIORITY_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              onChange={(v) => setPriority(Number(v ?? 0))}
            />
          </div>

          {/* An offset, not a second calendar: the reminder follows the due
              date instead of being a date you have to keep in sync by hand. */}
          <FilterSelect
            label="Recordatorio"
            value={remindOffset === null ? null : String(remindOffset)}
            allLabel="Sin recordatorio"
            options={TASK_REMINDER_OFFSETS.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
            onChange={(v) => setRemindOffset(v === null ? null : Number(v))}
          />

          <LinkInput value={links} onChange={setLinks} />

          <TaskEntityPicker key={formKey} value={link} onChange={setLink} disabled={busy} />

          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notas, contexto, lo que haga falta…"
            aria-label="Detalle"
          />

          <SheetActions>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy} variant="ink">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
          </SheetActions>
        </div>
      </ResponsiveSheet>
    </PageLayout>
  );
}
