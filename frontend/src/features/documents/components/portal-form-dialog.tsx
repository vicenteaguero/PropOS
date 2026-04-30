import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePortal } from "../hooks/use-portals";
import type { PortalAccess } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalFormDialog({ open, onOpenChange }: Props) {
  const create = useCreatePortal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessMode, setAccessMode] = useState<PortalAccess>("PASSWORD");
  const [password, setPassword] = useState("");
  const [maxMb, setMaxMb] = useState(50);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Título obligatorio");
      return;
    }
    try {
      await create.mutateAsync({
        title,
        description: description || undefined,
        access_mode: accessMode,
        password: accessMode === "PASSWORD" ? password || undefined : undefined,
        max_file_size_mb: maxMb,
      });
      toast.success("Portal creado");
      setTitle("");
      setDescription("");
      setPassword("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo portal de subida</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sube tus documentos aquí..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acceso</Label>
            <select
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value as PortalAccess)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="PUBLIC">Público (cualquiera con el link)</option>
              <option value="PASSWORD">Con password</option>
              <option value="QR_ONLY">Solo QR</option>
            </select>
          </div>
          {accessMode === "PASSWORD" && (
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Tamaño máximo por archivo (MB)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={maxMb}
              onChange={(e) => setMaxMb(Number(e.target.value) || 50)}
            />
          </div>
          <Button onClick={submit} disabled={create.isPending} className="w-full">
            Crear portal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
