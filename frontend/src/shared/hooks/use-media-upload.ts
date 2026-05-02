import { useState, useCallback } from "react";
import { supabase } from "@core/supabase/client";
import { useAuth } from "@shared/hooks/use-auth";

interface UseMediaUploadReturn {
  upload: (blob: Blob, type: "photo" | "audio") => Promise<string | null>;
  uploading: boolean;
  url: string | null;
  error: string | null;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (blob: Blob, type: "photo" | "audio"): Promise<string | null> => {
      if (!user) {
        setError("No autenticado");
        return null;
      }

      setUploading(true);
      setError(null);

      try {
        const ext = type === "photo" ? "jpg" : blob.type.includes("webm") ? "webm" : "mp4";
        const timestamp = Date.now();
        const path = `${user.tenantId}/${type}/${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, blob, { contentType: blob.type });

        if (uploadError) {
          setError(uploadError.message);
          return null;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);

        setUrl(publicUrl);
        return publicUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al subir archivo";
        setError(message);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [user],
  );

  return { upload, uploading, url, error };
}
