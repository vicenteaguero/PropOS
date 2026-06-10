import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar"),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });
}
