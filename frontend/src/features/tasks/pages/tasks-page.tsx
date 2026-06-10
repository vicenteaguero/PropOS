import { useMemo, useState } from "react";
import { isThisWeek, isToday } from "date-fns";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
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
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { toast } from "sonner";
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "../hooks/use-tasks";
import type { Task } from "../api/tasks-api";

type Bucket = "Hoy" | "Esta semana" | "Más adelante" | "Sin fecha";

function bucketOf(t: Task): Bucket {
  if (!t.due_at) return "Sin fecha";
  const d = new Date(t.due_at);
  if (isToday(d)) return "Hoy";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "Esta semana";
  return "Más adelante";
}

const ORDER: Bucket[] = ["Hoy", "Esta semana", "Más adelante", "Sin fecha"];

export function TasksPage() {
  const { data, isLoading, error, refetch } = useTasks({ only_open: true });
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const grouped = useMemo(() => {
    const g = new Map<Bucket, Task[]>();
    for (const t of data ?? []) {
      const b = bucketOf(t);
      if (!g.has(b)) g.set(b, []);
      g.get(b)!.push(t);
    }
    return g;
  }, [data]);

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

  return (
    <PageLayout width="md">
      <PageHeader
        title="Tareas"
        description="Pendientes, recordatorios y metas del equipo."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Nueva
          </Button>
        }
      />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
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

      <div className="space-y-6">
        {ORDER.filter((b) => grouped.has(b)).map((bucket) => (
          <section key={bucket}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {bucket}
            </h2>
            <ul className="divide-y rounded-lg border">
              {grouped.get(bucket)!.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    onClick={() => update.mutate({ id: t.id, body: { status: "DONE" } })}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full border text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500"
                    aria-label="Completar"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.title}</div>
                    {t.due_at && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.due_at).toLocaleString("es-CL", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={() => del.mutate(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
