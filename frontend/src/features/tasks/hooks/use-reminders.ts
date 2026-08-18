import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { remindersApi, type ReminderInput, type ReminderTargetTable } from "../api/reminders-api";

interface ReminderListParams {
  target_table?: ReminderTargetTable;
  target_row_id?: string;
}

export const remindersKeys = {
  all: ["reminders"] as const,
  list: (params: ReminderListParams) => ["reminders", "list", params] as const,
};

export function useReminders(params: ReminderListParams = {}) {
  return useQuery({
    queryKey: remindersKeys.list(params),
    queryFn: () => remindersApi.list(params),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Creates the reminder row that makes the push dispatcher fire.
 *
 * No `onError` toast on purpose: callers chain this after creating the target
 * row (task, event), so they need to report the partial success themselves
 * instead of showing a second, contradictory toast.
 */
export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReminderInput) => remindersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: remindersKeys.all }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: remindersKeys.all }),
  });
}
