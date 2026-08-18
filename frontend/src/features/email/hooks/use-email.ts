import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { emailApi, type SendEmailInput } from "../api/email-api";

export const emailKeys = {
  all: ["email"] as const,
  threads: (params: { status?: string; contact_id?: string; q?: string }) =>
    ["email", "threads", params] as const,
  thread: (id: string) => ["email", "thread", id] as const,
};

export function useEmailThreads(params: { status?: string; contact_id?: string; q?: string } = {}) {
  return useQuery({
    queryKey: emailKeys.threads(params),
    queryFn: () => emailApi.listThreads(params),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useEmailThread(id: string | undefined) {
  return useQuery({
    queryKey: emailKeys.thread(id ?? ""),
    queryFn: () => emailApi.getThread(id as string),
    enabled: !!id,
  });
}

export function useReplyEmail(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => emailApi.reply(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emailKeys.thread(id) });
      qc.invalidateQueries({ queryKey: emailKeys.all });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la respuesta"),
  });
}

/** Starts a brand-new thread (first contact). Delivery goes through Resend. */
export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendEmailInput) => emailApi.send(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: emailKeys.all }),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el correo"),
  });
}
