import { AddDocumentCard } from "@features/documents/components/fast-add-fab";

export function EmptyDashboard() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Inicio</h1>
        <p className="text-sm text-muted-foreground">Empieza por aquí.</p>
      </div>
      <div className="grid gap-3">
        <AddDocumentCard />
      </div>
    </div>
  );
}
