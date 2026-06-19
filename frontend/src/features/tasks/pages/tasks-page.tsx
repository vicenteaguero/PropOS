import { useMemo, useState } from "react";
import { isPast, isThisWeek, isToday } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Chip, Chips, Pill, ResponsiveSheet, Row, RoundButton, SectionLabel } from "@shared/ui";
import { toast } from "sonner";
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "../hooks/use-tasks";
import type { Task } from "../api/tasks-api";

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

/** One bucket: heading + its task rows. Same markup on mobile and desktop. */
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

export function TasksPage() {
  const { data, isLoading, error, refetch } = useTasks({ only_open: true });
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [filter, setFilter] = useState<"all" | Bucket>("all");

  const grouped = useMemo(() => {
    const g = new Map<Bucket, Task[]>();
    for (const t of data ?? []) {
      const b = bucketOf(t);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
    }
    return g;
  }, [data]);

  const visibleBuckets = ORDER.filter((b) => grouped.has(b)).filter(
    (b) => filter === "all" || b === filter,
  );

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Agregá un título");
      return;
    }
    await create.mutateAsync({
      title: title.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setTitle("");
    setDueAt("");
    setOpen(false);
    toast.success("Tarea creada");
  };

  const complete = (id: string) => update.mutate({ id, body: { status: "DONE" } });
  const remove = (id: string) => del.mutate(id);

  // Desktop arranges the visible buckets into two columns; mobile stays flat.
  const leftCol = visibleBuckets.filter((b) => LEFT_BUCKETS.includes(b));
  const rightCol = visibleBuckets.filter((b) => RIGHT_BUCKETS.includes(b));

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

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="mx-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive lg:mx-8">
          No se pudieron cargar las tareas.
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
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
          <Chips className="px-5 pb-5 lg:px-8">
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

          {/* Mobile: single flat column (unchanged). */}
          <div className="space-y-7 pb-6 lg:hidden">
            {visibleBuckets.map((bucket) => (
              <BucketSection
                key={bucket}
                bucket={bucket}
                tasks={grouped.get(bucket)!}
                onComplete={complete}
                onDelete={remove}
              />
            ))}
          </div>

          {/* Desktop: two columns — near-term left, later right. */}
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

      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Nueva tarea">
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-due">Vence (opcional)</Label>
            <Input
              id="t-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
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
    </PageLayout>
  );
}
