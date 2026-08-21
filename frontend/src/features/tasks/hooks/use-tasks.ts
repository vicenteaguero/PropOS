import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { editByPrefix, patchById, removeById, rollbackAll } from "@shared/lib/optimistic";
import { tasksApi, type TaskInput } from "../api/tasks-api";

export const tasksKeys = {
  all: ["tasks"] as const,
  list: (params: { only_open?: boolean; status?: string }) => ["tasks", "list", params] as const,
};

export function useTasks(params: { only_open?: boolean; status?: string } = {}) {
  return useQuery({
    queryKey: tasksKeys.list(params),
    queryFn: () => tasksApi.list(params),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => tasksApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea"),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TaskInput> }) =>
      tasksApi.update(id, body),
    // Ticking a task off is the most-pressed control in the app and it used to
    // wait for the round trip before the row changed. The patch is applied to
    // every cached view of the task first; the invalidation below still has the
    // last word.
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: tasksKeys.all });
      return { snapshots: editByPrefix(qc, tasksKeys.all, (d: unknown) => patchById(d, id, body)) };
    },
    onError: (err, _vars, ctx) => {
      rollbackAll(qc, ctx?.snapshots);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    },
    // onSettled, not onSuccess: the server has to reconcile on the failure path
    // too, or a rolled-back row keeps whatever the cache happened to hold.
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: tasksKeys.all });
      return { snapshots: editByPrefix(qc, tasksKeys.all, (d: unknown) => removeById(d, id)) };
    },
    onError: (err, _id, ctx) => {
      rollbackAll(qc, ctx?.snapshots);
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}
