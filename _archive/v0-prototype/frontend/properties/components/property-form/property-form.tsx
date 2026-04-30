import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Property, PropertyStatus, CreatePropertyPayload } from "@features/properties/types";

interface PropertyFormProps {
  initialData?: Property;
  onSubmit: (data: CreatePropertyPayload) => void;
  isLoading: boolean;
}

const STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "RESERVED", label: "Reservada" },
  { value: "SOLD", label: "Vendida" },
  { value: "INACTIVE", label: "Inactiva" },
];

export function PropertyForm({ initialData, onSubmit, isLoading }: PropertyFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [status, setStatus] = useState<PropertyStatus>(initialData?.status ?? "AVAILABLE");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [surfaceM2, setSurfaceM2] = useState(initialData?.surfaceM2?.toString() ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const surfaceValue = surfaceM2 ? Number(surfaceM2) : null;

    onSubmit({
      title,
      description: description || null,
      status,
      address: address || null,
      surfaceM2: surfaceValue,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-title">Título</Label>
        <Input
          id="prop-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-description">Descripción</Label>
        <textarea
          id="prop-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-status">Estado</Label>
        <select
          id="prop-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as PropertyStatus)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-address">Dirección</Label>
        <Input
          id="prop-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prop-surface">Superficie (m²)</Label>
        <Input
          id="prop-surface"
          type="number"
          min="0"
          step="0.01"
          value={surfaceM2}
          onChange={(e) => setSurfaceM2(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Button type="submit" disabled={isLoading} className="mt-2">
        {initialData ? "Guardar Cambios" : "Crear Propiedad"}
      </Button>
    </form>
  );
}
