import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shareLinksApi, type CreateShareInput, type UpdateShareInput } from "../api/share-links-api";

export const shareKeys = {
  all: ["share-links"] as const,
};

export function useShareLinks() {
  return useQuery({
    queryKey: shareKeys.all,
    queryFn: () => shareLinksApi.list(),
  });
}

export function useCreateShareLink(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShareInput) => shareLinksApi.create(documentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
  });
}

export function useUpdateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { linkId: string; body: UpdateShareInput }) =>
      shareLinksApi.update(input.linkId, input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
  });
}

export function useDeleteShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => shareLinksApi.remove(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
  });
}
