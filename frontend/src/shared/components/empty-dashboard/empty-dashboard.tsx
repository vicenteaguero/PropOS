import { Hammer } from "lucide-react";

export function EmptyDashboard() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Hammer className="size-14 text-primary/40" strokeWidth={1.25} />
      <h2 className="text-lg font-semibold text-foreground">Construyendo</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Las features reales se conectarán aquí pronto.
      </p>
    </div>
  );
}
