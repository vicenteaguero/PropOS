import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { propertiesApi } from "../api/properties-api";
import { trackAction } from "@core/telemetry/usage";

export const propertyPhotoKeys = {
  all: ["admin", "property-photos"] as const,
  list: (propertyId: string) => ["admin", "property-photos", propertyId] as const,
};

/**
 * Photos attached to a property — both agent-ingested (WhatsApp) and uploaded.
 * URLs are signed with a 1h TTL server-side, so we keep them well short of that.
 */
export function usePropertyPhotos(propertyId: string | undefined) {
  return useQuery({
    queryKey: propertyPhotoKeys.list(propertyId ?? ""),
    queryFn: () => propertiesApi.photos(propertyId as string),
    enabled: !!propertyId,
    staleTime: 10 * 60_000,
  });
}

export function useUploadPropertyPhotos(propertyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => propertiesApi.uploadPhotos(propertyId as string, files),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: propertyPhotoKeys.list(propertyId ?? "") });
      toast.success(created.length === 1 ? "Foto agregada" : `${created.length} fotos agregadas`);
      trackAction("fotos_subidas", { count: created.length });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudieron subir las fotos"),
  });
}

export function useDeletePropertyPhoto(propertyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => propertiesApi.deletePhoto(propertyId as string, assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyPhotoKeys.list(propertyId ?? "") });
      toast.success("Foto eliminada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo eliminar"),
  });
}
