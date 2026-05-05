import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entitiesApi } from "../api/entities-api";

export const entitiesKeys = {
  properties: (q?: string) => ["entities", "properties", q ?? ""] as const,
  contacts: (q?: string, propertyId?: string) =>
    ["entities", "contacts", q ?? "", propertyId ?? ""] as const,
  areas: ["entities", "areas"] as const,
};

interface EntityQueryOpts {
  enabled?: boolean;
}

interface ContactsQueryOpts extends EntityQueryOpts {
  propertyId?: string;
}

export function useProperties(q?: string, opts: EntityQueryOpts = {}) {
  return useQuery({
    queryKey: entitiesKeys.properties(q),
    queryFn: () => entitiesApi.listProperties(q),
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useContacts(q?: string, opts: ContactsQueryOpts = {}) {
  return useQuery({
    queryKey: entitiesKeys.contacts(q, opts.propertyId),
    queryFn: () => entitiesApi.listContacts(q, opts.propertyId),
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useInternalAreas() {
  return useQuery({
    queryKey: entitiesKeys.areas,
    queryFn: () => entitiesApi.listAreas(),
  });
}

export function useCreateDraftProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => entitiesApi.createProperty(title, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entities", "properties"] }),
  });
}

export function useCreateDraftContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fullName: string) => entitiesApi.createContact(fullName, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entities", "contacts"] }),
  });
}
