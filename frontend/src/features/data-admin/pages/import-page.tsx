import { useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import {
  ErrorState,
  FOCUS_RING,
  PageSkeleton,
  Pill,
  Row,
  Segmented,
  TOUCH_TARGET_HIT_AREA,
  type PillTone,
} from "@shared/ui";
import { toast } from "sonner";
import { type ImportJob, type ImportPreview } from "../api/imports-api";
import { useCommitImport, useImports, usePreviewImport } from "../hooks/use-imports";

const ENTITIES = [
  { id: "contacts", label: "Contactos" },
  { id: "properties", label: "Propiedades" },
  { id: "transactions", label: "Transacciones" },
];

/** Job statuses as stored in `import_jobs.status`. */
const STATUS_LABELS: Record<string, string> = {
  PREVIEW: "Sin confirmar",
  COMMITTED: "Importado",
  FAILED: "Falló",
  DISCARDED: "Descartado",
};

const STATUS_TONE: Record<string, PillTone> = {
  PREVIEW: "warning",
  COMMITTED: "success",
  FAILED: "destructive",
  DISCARDED: "neutral",
};

/** Newest jobs first; the page shows a recent slice, not the full history. */
const HISTORY_LIMIT = 8;

function entityLabel(id: string): string {
  return ENTITIES.find((e) => e.id === id)?.label ?? id;
}

function jobCounts(job: ImportJob): string {
  if (job.status === "COMMITTED") return `${job.inserted_rows ?? 0} importados`;
  return `${job.valid_rows ?? 0} de ${job.total_rows ?? 0} válidos`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export function ImportPage() {
  const [entity, setEntity] = useState("contacts");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const jobs = useImports();
  const previewImport = usePreviewImport();
  const commitImport = useCommitImport();
  const busy = previewImport.isPending || commitImport.isPending;

  const history = [...(jobs.data ?? [])]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, HISTORY_LIMIT);

  const doPreview = async () => {
    if (!file) {
      toast.error("Seleccioná un archivo CSV");
      return;
    }
    try {
      setPreview(await previewImport.mutateAsync({ entity, file }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  const doCommit = async () => {
    if (!preview) return;
    try {
      const r = await commitImport.mutateAsync(preview.import_id);
      toast.success(`${r.inserted_rows} registros importados`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    }
  };

  return (
    // Mobile: capped column with the cards stacked. Desktop: a wider page where
    // upload (left) and preview (right) sit side by side, both visible at once.
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-4xl lg:px-8 lg:pt-7">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 lg:px-0 lg:pt-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Importar datos
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Cargá datos históricos desde un CSV y revisá antes de confirmar.
        </p>
      </div>

      {/* Entity picker */}
      <Segmented
        items={ENTITIES}
        value={entity}
        onChange={(id) => {
          setEntity(id);
          setPreview(null);
        }}
        className="mb-5 lg:px-0"
      />

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Upload card */}
        <div className="px-5 lg:px-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            {/* The clear control is a sibling of the label, not a child: a
                <label> may not contain interactive content, and nested inside
                it every click on "quitar" also reopened the file picker. */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-secondary/40 px-4 py-4 transition focus-within:border-ring hover:bg-secondary">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                  <FileUp className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {file ? file.name : "Elegí un archivo CSV"}
                  </span>
                  <span className="block text-[13px] text-muted-foreground">
                    {file ? `${(file.size / 1024).toFixed(0)} KB` : "Toca para seleccionar"}
                  </span>
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              </label>
              {file && (
                <button
                  type="button"
                  aria-label="Quitar archivo"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted ${FOCUS_RING} ${TOUCH_TARGET_HIT_AREA}`}
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="size-4" strokeWidth={1.8} />
                </button>
              )}
            </div>

            <Button
              onClick={doPreview}
              disabled={busy || !file}
              variant="ink"
              size="block"
              className="mt-4"
            >
              {previewImport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" strokeWidth={1.8} />
              )}
              Previsualizar
            </Button>
          </div>
        </div>

        {/* Preview — second column on desktop, stacked below on mobile. */}
        {preview ? (
          <div className="mt-4 px-5 lg:mt-0 lg:px-0">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="success">{preview.valid_rows} válidos</Pill>
                {preview.invalid_rows > 0 && (
                  <Pill tone="destructive">{preview.invalid_rows} con error</Pill>
                )}
                <Pill tone="neutral">{preview.total_rows} filas</Pill>
              </div>

              {preview.errors.length > 0 && (
                <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-secondary/40 p-3 text-[13px]">
                  {preview.errors.map((e, i) => (
                    <div key={i} className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Fila {e.row + 1}</span>:{" "}
                      {e.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  onClick={doCommit}
                  disabled={busy || preview.valid_rows === 0}
                  variant="ink"
                  size="block"
                >
                  {commitImport.isPending && <Loader2 className="size-4 animate-spin" />}
                  Importar {preview.valid_rows} registros
                </Button>
                <Button
                  variant="ghost"
                  size="block"
                  onClick={() => setPreview(null)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Desktop placeholder keeps the two-column grid balanced before preview.
          <div className="hidden lg:flex lg:min-h-[12rem] lg:items-center lg:justify-center lg:rounded-2xl lg:border lg:border-dashed lg:border-border lg:p-6 lg:text-center lg:text-sm lg:text-muted-foreground">
            Previsualizá un CSV para ver el resultado acá.
          </div>
        )}
      </div>

      {/* History — a staged job stays PREVIEW until it is confirmed, so this is
          also where an interrupted import shows up. */}
      <section className="mt-8 px-5 lg:px-0">
        <h2 className="mb-2 text-[16px] font-bold tracking-tight text-foreground">
          Importaciones recientes
        </h2>

        {jobs.isLoading && <PageSkeleton variant="list" count={3} />}

        {!jobs.isLoading && jobs.error && (
          <ErrorState
            message="No se pudo cargar el historial de importaciones."
            onRetry={() => void jobs.refetch()}
            compact
          />
        )}

        {!jobs.isLoading && !jobs.error && history.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[13px] text-muted-foreground">
            Todavía no importaste ningún archivo.
          </p>
        )}

        {!jobs.isLoading && !jobs.error && history.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {history.map((job, i) => (
              <Row
                key={job.id}
                divider={i < history.length - 1}
                title={job.filename ?? "import.csv"}
                sub={`${entityLabel(job.entity)} · ${fmtDate(job.created_at)}`}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={STATUS_TONE[job.status] ?? "neutral"}>
                      {STATUS_LABELS[job.status] ?? job.status}
                    </Pill>
                    <span className="text-xs text-faint">{jobCounts(job)}</span>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
