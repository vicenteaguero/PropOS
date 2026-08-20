import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";
import { contactsApi, type ListContactsParams } from "../api/contacts-api";
import type { ContactOverview } from "../types";
import type { ContactInput } from "../types";

export const contactsKeys = {
  all: ["contacts"] as const,
  list: (params: ListContactsParams) => ["contacts", "list", params] as const,
  detail: (id: string) => ["contacts", "detail", id] as const,
  overview: (id: string) => ["contacts", "overview", id] as const,
};

export function useContacts(params: ListContactsParams = {}) {
  return useQuery({
    queryKey: contactsKeys.list(params),
    queryFn: () => contactsApi.list(params),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: contactsKeys.detail(id ?? ""),
    queryFn: () => contactsApi.get(id as string),
    enabled: !!id,
  });
}

/**
 * Where the relationship stands, in one request.
 *
 * The person page used to answer this by mounting four tabs that each fetched
 * on open, so nothing about the state of the relationship was visible until
 * the broker went looking for it tab by tab.
 */
export function useContactOverview(id: string | undefined) {
  return useQuery({
    queryKey: contactsKeys.overview(id ?? ""),
    queryFn: () => apiRequest<ContactOverview>(`/v1/contacts/${id}/overview`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ContactInput) => contactsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKeys.all }),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo crear el contacto"),
  });
}

export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ContactInput>) => contactsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactsKeys.all });
      qc.invalidateQueries({ queryKey: contactsKeys.detail(id) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: contactsKeys.all }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });
}
