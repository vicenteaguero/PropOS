import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ResponsiveSheet } from "@shared/ui";
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
      toast.success("Enlace creado");
      setTitle("");
      setDescription("");
      setPassword("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Nuevo enlace de subida">
      <div className="space-y-3">
        <Field label="Título" labelClassName="text-xs">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Descripción" labelClassName="text-xs">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sube tus documentos aquí…"
          />
        </Field>
        <Field label="Acceso" labelClassName="text-xs">
          <select
            value={accessMode}
            onChange={(e) => setAccessMode(e.target.value as PortalAccess)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="PUBLIC">Público (cualquiera con el enlace)</option>
            <option value="PASSWORD">Con password</option>
            <option value="QR_ONLY">Solo QR</option>
          </select>
        </Field>
        {accessMode === "PASSWORD" && (
          <Field label="Password" labelClassName="text-xs">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <Field label="Tamaño máximo por archivo (MB)" labelClassName="text-xs">
          <Input
            type="number"
            min={1}
            max={200}
            value={maxMb}
            onChange={(e) => setMaxMb(Number(e.target.value) || 50)}
          />
        </Field>
        <Button onClick={submit} disabled={create.isPending} className="w-full">
          Crear enlace
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
