import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entitiesApi } from "../api/entities-api";

export const entitiesKeys = {
  properties: (q?: string) => ["entities", "properties", q ?? ""] as const,
  contacts: (q?: string) => ["entities", "contacts", q ?? ""] as const,
  areas: ["entities", "areas"] as const,
};

export function useProperties(q?: string) {
  return useQuery({
    queryKey: entitiesKeys.properties(q),
    queryFn: () => entitiesApi.listProperties(q),
  });
}

export function useContacts(q?: string) {
  return useQuery({
    queryKey: entitiesKeys.contacts(q),
    queryFn: () => entitiesApi.listContacts(q),
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
