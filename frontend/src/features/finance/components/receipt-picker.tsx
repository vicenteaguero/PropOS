import { Suspense, lazy, useState } from "react";
import { Loader2, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EntityCombobox } from "@features/documents/components/entity-combobox";
import {
  useCreateDocument,
  useDocument,
  useDocuments,
} from "@features/documents/hooks/use-documents";
import type { DocumentItem } from "@features/documents/types";

// The dropzone pulls in `file-type` for magic-byte validation — keep it out of
// the finance chunk until the sheet is actually open.
const UploadDropzone = lazy(() =>
  import("@features/documents/components/upload-dropzone").then((m) => ({
    default: m.UploadDropzone,
  })),
);

/** Tag applied to receipts uploaded from finance, matching the documents quick tags. */
const RECEIPT_TAG = "Boleta";

interface Props {
  /** `receipt_document_id` of the transaction, or null when none is attached. */
  value: string | null;
  onChange: (documentId: string | null) => void;
  disabled?: boolean;
}

/**
 * Attaches a receipt to a transaction: uploads a new document or picks one
 * already in the library. Resolves the display name from the id so it also
 * works when editing a transaction that already carries a receipt.
 */
export function ReceiptPicker({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const create = useCreateDocument();
  const { data: picked, isLoading: loadingPicked } = useDocument(value ?? undefined);
  const { data: documents = [], isFetching } = useDocuments({ q: query || undefined });

  const handleFile = async (file: File) => {
    try {
      const doc = await create.mutateAsync({
        file,
        displayName: file.name.replace(/\.[^/.]+$/, ""),
        origin: "UPLOAD",
        tag: RECEIPT_TAG,
      });
      onChange(doc.id);
      toast.success("Boleta adjuntada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la boleta");
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <Receipt className="size-4" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {loadingPicked ? "Cargando…" : (picked?.display_name ?? "Documento adjunto")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar boleta"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Suspense
        fallback={
          <div className="flex aspect-[5/4] items-center justify-center rounded-xl border border-dashed border-border">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        }
      >
        {create.isPending ? (
          <div className="flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Subiendo…</span>
          </div>
        ) : (
          <UploadDropzone onFile={handleFile} disabled={disabled} compact />
        )}
      </Suspense>
      <div className="flex flex-col justify-center gap-2">
        <EntityCombobox<DocumentItem>
          value=""
          onChange={setQuery}
          onSelect={(doc) => doc && onChange(doc.id)}
          items={documents}
          getLabel={(doc) => doc.display_name}
          getKey={(doc) => doc.id}
          loading={isFetching}
          placeholder="Buscar documento"
          emptyText="Sin documentos"
          disabled={disabled}
          ariaLabel="Elegir boleta existente"
        />
        <p className="text-xs leading-tight text-muted-foreground">
          Subí la boleta o elegí un documento ya cargado.
        </p>
      </div>
    </div>
  );
}
