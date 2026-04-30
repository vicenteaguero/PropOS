// TODO: producción — refactor cuando una feature real consuma media uploads (revisar RLS, paths por tenant, garbage collection).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@core/supabase/client";
import { useAuth } from "@shared/hooks/use-auth";
import { useCallback } from "react";

type MediaType = "photo" | "audio";
type MediaSource = "camera" | "gallery" | "recorder";

interface MediaFile {
  id: string;
  url: string;
  type: MediaType;
  source: MediaSource;
  created_at: string;
}

const MEDIA_QUERY_KEY = ["media-files"] as const;

export function useMediaFiles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<MediaFile[], Error>({
    queryKey: MEDIA_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as MediaFile[];
    },
    enabled: Boolean(user),
  });

  const saveMediaFile = useCallback(
    async (url: string, type: MediaType, source: MediaSource) => {
      if (!user) return;

      const { error } = await supabase.from("media_files").insert({
        url,
        type,
        source,
        tenant_id: user.tenantId,
        uploaded_by: user.id,
      });

      if (!error) {
        queryClient.invalidateQueries({ queryKey: MEDIA_QUERY_KEY });
      }
    },
    [user, queryClient],
  );

  const photos = query.data?.filter((m) => m.type === "photo" && m.source === "camera") ?? [];
  const galleryPhotos = query.data?.filter((m) => m.type === "photo" && m.source === "gallery") ?? [];
  const audios = query.data?.filter((m) => m.type === "audio") ?? [];

  return { ...query, photos, galleryPhotos, audios, saveMediaFile };
}
