import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { financeApi, type TransactionInput } from "../api/finance-api";

export const financeKeys = {
  all: ["finance"] as const,
  list: (params: { status?: string; direction?: string; category?: string }) =>
    ["finance", "tx", params] as const,
  summary: (month?: string) => ["finance", "summary", month] as const,
};

export function useTransactions(
  params: { status?: string; direction?: string; category?: string } = {},
) {
  return useQuery({
    queryKey: financeKeys.list(params),
    queryFn: () => financeApi.list(params),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useFinanceSummary(month?: string) {
  return useQuery({
    queryKey: financeKeys.summary(month),
    queryFn: () => financeApi.summary(month),
    staleTime: 15_000,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionInput) => financeApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear"),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<TransactionInput> }) =>
      financeApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo actualizar"),
  });
}

export function useCompleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeApi.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo completar"),
  });
}
