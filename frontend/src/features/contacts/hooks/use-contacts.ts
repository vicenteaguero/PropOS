import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";
import { contactsApi, type ListContactsParams } from "../api/contacts-api";
import type {
  ContactChannels,
  ContactDuplicate,
  ContactEmail,
  ContactOverview,
  ContactPhone,
} from "../types";
import type { ContactInput } from "../types";

export const contactsKeys = {
  all: ["contacts"] as const,
  list: (params: ListContactsParams) => ["contacts", "list", params] as const,
  detail: (id: string) => ["contacts", "detail", id] as const,
  overview: (id: string) => ["contacts", "overview", id] as const,
  channels: (id: string) => ["contacts", "channels", id] as const,
  duplicates: ["contacts", "duplicates"] as const,
};

export function useContacts(params: ListContactsParams = {}) {
  return useQuery({
    queryKey: contactsKeys.list(params),
    queryFn: () => contactsApi.list(params),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

/** Rows per request. Small enough to paint fast, big enough to fill a screen. */
export const CONTACTS_PAGE_SIZE = 50;

/**
 * The people list, paged.
 *
 * `useContacts` asks for a fixed slab and the endpoint silently caps it, so a
 * tenant with more people than the cap simply could not reach the rest — the
 * list looked complete and the missing rows read as missing data.
 * `ListCapNotice` was built to admit that in the UI; this removes the reason
 * for it.
 */
export function useContactsInfinite(params: Omit<ListContactsParams, "offset"> = {}) {
  return useInfiniteQuery({
    queryKey: contactsKeys.list({ ...params, infinite: true } as ListContactsParams),
    queryFn: ({ pageParam }) =>
      contactsApi.list({ ...params, limit: CONTACTS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // A short page means the end. The endpoint returns rows, not a total, so
    // there is nothing else to go on — and asking for a count on every page
    // would cost more than the page.
    getNextPageParam: (last, all) =>
      last.length < CONTACTS_PAGE_SIZE ? undefined : all.length * CONTACTS_PAGE_SIZE,
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

export function useContactChannels(id: string | undefined) {
  return useQuery({
    queryKey: contactsKeys.channels(id ?? ""),
    queryFn: () => apiRequest<ContactChannels>(`/v1/contacts/${id}/channels`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

/** Adding a channel invalidates the contact too: the scalar mirror moved. */
function useChannelMutation<T>(contactId: string, path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ value, label }: { value: string; label: string | null }) =>
      apiRequest<T>(`/v1/contacts/${contactId}/${path}`, {
        method: "POST",
        body: path === "phones" ? { phone: value, label } : { email: value, label },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: contactsKeys.channels(contactId) });
      void qc.invalidateQueries({ queryKey: contactsKeys.detail(contactId) });
    },
  });
}

export function useAddContactPhone(contactId: string) {
  return useChannelMutation<ContactPhone>(contactId, "phones");
}

export function useAddContactEmail(contactId: string) {
  return useChannelMutation<ContactEmail>(contactId, "emails");
}

function useChannelRemoval(contactId: string, path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/v1/contacts/${contactId}/${path}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: contactsKeys.channels(contactId) });
      void qc.invalidateQueries({ queryKey: contactsKeys.detail(contactId) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo quitar"),
  });
}

export function useRemoveContactPhone(contactId: string) {
  return useChannelRemoval(contactId, "phones");
}

export function useRemoveContactEmail(contactId: string) {
  return useChannelRemoval(contactId, "emails");
}

/**
 * People who look like the same person.
 *
 * A pair, never a constraint: a couple sharing a phone number is real data, so
 * the database accepts it and this offers the merge instead of refusing the row.
 */
export function useContactDuplicates() {
  return useQuery({
    queryKey: contactsKeys.duplicates,
    queryFn: () => apiRequest<ContactDuplicate[]>("/v1/contacts/duplicates"),
    // Duplicates accumulate over hours, not seconds.
    staleTime: 5 * 60_000,
  });
}

export function useMergeContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ winnerId, loserId }: { winnerId: string; loserId: string }) =>
      apiRequest<{ merged_into: string }>(`/v1/contacts/${winnerId}/merge`, {
        method: "POST",
        body: { loser_id: loserId },
      }),
    onSuccess: () => {
      // A merge repoints eighteen foreign keys, so everything is stale.
      void qc.invalidateQueries({ queryKey: contactsKeys.all });
      toast.success("Personas fusionadas");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo fusionar"),
  });
}
