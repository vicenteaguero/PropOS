import { useState, type FormEvent } from "react";
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

const FIELD_LABELS = {
  TITLE: "T\u00EDtulo",
  DESCRIPTION: "Descripci\u00F3n",
  STATUS: "Estado",
  ADDRESS: "Direcci\u00F3n",
  SURFACE: "Superficie (m\u00B2)",
  SUBMIT_CREATE: "Crear Propiedad",
  SUBMIT_UPDATE: "Guardar Cambios",
};

const INPUT_CLASS =
  "min-h-11 w-full rounded-md border border-gris-acero/30 bg-negro-carbon px-3 py-2 text-sm text-blanco-nieve placeholder:text-gris-acero/50 focus:border-rosa-antiguo focus:outline-none focus:ring-1 focus:ring-rosa-antiguo";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="prop-title" className="text-sm font-medium text-gris-acero">
          {FIELD_LABELS.TITLE}
        </label>
        <input
          id="prop-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT_CLASS}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="prop-description" className="text-sm font-medium text-gris-acero">
          {FIELD_LABELS.DESCRIPTION}
        </label>
        <textarea
          id="prop-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${INPUT_CLASS} resize-none`}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="prop-status" className="text-sm font-medium text-gris-acero">
          {FIELD_LABELS.STATUS}
        </label>
        <select
          id="prop-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as PropertyStatus)}
          className={INPUT_CLASS}
          disabled={isLoading}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="prop-address" className="text-sm font-medium text-gris-acero">
          {FIELD_LABELS.ADDRESS}
        </label>
        <input
          id="prop-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={INPUT_CLASS}
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="prop-surface" className="text-sm font-medium text-gris-acero">
          {FIELD_LABELS.SURFACE}
        </label>
        <input
          id="prop-surface"
          type="number"
          min="0"
          step="0.01"
          value={surfaceM2}
          onChange={(e) => setSurfaceM2(e.target.value)}
          className={INPUT_CLASS}
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 min-h-11 rounded-md bg-rosa-antiguo px-4 py-3 text-sm font-semibold text-negro-carbon transition-colors duration-150 hover:bg-rosa-suave disabled:opacity-50"
      >
        {initialData ? FIELD_LABELS.SUBMIT_UPDATE : FIELD_LABELS.SUBMIT_CREATE}
      </button>
    </form>
  );
}
