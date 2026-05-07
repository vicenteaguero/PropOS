import { useRef, useState } from "react";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { settingsApi, type UserMe } from "../api/settings-api";

interface Props {
  user: UserMe;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarUploader({ user }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const setUrl = useMutation({
    mutationFn: (url: string | null) => settingsApi.updateAvatar(url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "me"] });
      qc.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5 MB");
      return;
    }
    setUploading(true);
    try {
      const url = await settingsApi.uploadAvatar(user.id, file);
      await setUrl.mutateAsync(url);
      toast.success("Avatar actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error subiendo avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
        <AvatarFallback className="text-lg">{getInitials(user.full_name)}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || setUrl.isPending}
          >
            {uploading || setUrl.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Subir foto
          </Button>
          {user.avatar_url && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setUrl.mutate(null)}
              disabled={setUrl.isPending}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG / PNG / WebP, max 5 MB.</p>
      </div>
    </div>
  );
}
