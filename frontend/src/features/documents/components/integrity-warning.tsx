import { ShieldAlert } from "lucide-react";

export function IntegrityWarning() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
      <ShieldAlert className="size-4 shrink-0" />
      <span>
        El archivo en caché no coincide con el hash registrado. Se descargó una nueva copia desde el
        servidor.
      </span>
    </div>
  );
}
