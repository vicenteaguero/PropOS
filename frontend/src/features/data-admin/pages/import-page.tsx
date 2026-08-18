import { useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { Pill, Segmented } from "@shared/ui";
import { toast } from "sonner";
import { importsApi, type ImportPreview } from "../api/imports-api";

const ENTITIES = [
  { id: "contacts", label: "Contactos" },
  { id: "properties", label: "Propiedades" },
  { id: "transactions", label: "Transacciones" },
];

export function ImportPage() {
  const [entity, setEntity] = useState("contacts");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const doPreview = async () => {
    if (!file) {
      toast.error("Seleccioná un archivo CSV");
      return;
    }
    setBusy(true);
    try {
      setPreview(await importsApi.preview(entity, file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setBusy(false);
    }
  };

  const doCommit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await importsApi.commit(preview.import_id);
      toast.success(`${r.inserted_rows} registros importados`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setBusy(false);
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
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong bg-secondary/40 px-4 py-4 transition hover:bg-secondary">
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
              {file && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Quitar archivo"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="size-4" strokeWidth={1.8} />
                </span>
              )}
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

            <Button
              onClick={doPreview}
              disabled={busy || !file}
              variant="ink"
              size="block"
              className="mt-4"
            >
              {busy && !preview ? (
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
                  {busy && <Loader2 className="size-4 animate-spin" />}
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
    </PageLayout>
  );
}
