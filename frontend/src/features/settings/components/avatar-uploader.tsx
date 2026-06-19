import { useRef, useState } from "react";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@shared/ui";
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

  const busy = uploading || setUrl.isPending;

  return (
    <div className="flex flex-col items-center px-5 pt-2 pb-6 text-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative rounded-full transition active:scale-[0.97] disabled:pointer-events-none"
        aria-label="Cambiar foto"
      >
        <Avatar className="size-24">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? ""} />}
          <AvatarFallback className="bg-secondary text-2xl font-semibold text-foreground">
            {getInitials(user.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Upload className="size-4" strokeWidth={1.8} />
          )}
        </span>
      </button>

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

      <h2 className="mt-4 text-[22px] font-bold leading-tight tracking-tight text-foreground">
        {user.full_name || "Sin nombre"}
      </h2>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <Pill tone="accent">{user.role}</Pill>
        {user.email && <span className="text-[13px] text-muted-foreground">{user.email}</span>}
      </div>

      {user.avatar_url && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setUrl.mutate(null)}
          disabled={setUrl.isPending}
          className="mt-3 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" strokeWidth={1.8} />
          Quitar foto
        </Button>
      )}
    </div>
  );
}
