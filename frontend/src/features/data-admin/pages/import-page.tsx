import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { toast } from "sonner";
import { importsApi, type ImportPreview } from "../api/imports-api";

const ENTITIES = [
  { value: "contacts", label: "Contactos" },
  { value: "transactions", label: "Transacciones" },
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
    <PageLayout width="lg">
      <PageHeader
        title="Importar datos"
        description="Cargá datos históricos desde un CSV (vista previa antes de confirmar)."
      />

      <Card className="mb-4">
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Entidad</Label>
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setPreview(null);
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Archivo CSV</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>
          <Button onClick={doPreview} disabled={busy || !file} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Previsualizar
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500">
                {preview.valid_rows} válidos
              </Badge>
              {preview.invalid_rows > 0 && (
                <Badge variant="outline" className="bg-destructive/15 text-destructive">
                  {preview.invalid_rows} con error
                </Badge>
              )}
              <Badge variant="outline">{preview.total_rows} filas</Badge>
            </div>

            {preview.errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                {preview.errors.map((e, i) => (
                  <div key={i} className="text-muted-foreground">
                    Fila {e.row + 1}: {e.message}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button
                onClick={doCommit}
                disabled={busy || preview.valid_rows === 0}
                className="gap-2"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Importar {preview.valid_rows} registros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
