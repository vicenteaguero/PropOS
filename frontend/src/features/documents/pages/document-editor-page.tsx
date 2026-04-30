import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { useAuth } from "@shared/hooks/use-auth";
import { useAddVersion, useDocument } from "../hooks/use-documents";
import { useDocumentBlob } from "../hooks/use-document-blob";
import { DocumentEditor } from "../components/document-editor";

export function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: doc, isLoading } = useDocument(id);
  const currentVersion = doc?.current_version ?? doc?.versions?.[0] ?? null;
  const blobState = useDocumentBlob(id, currentVersion);
  const addVersion = useAddVersion(id ?? "");

  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!blobState.blob) {
      setBytes(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const buf = new Uint8Array(await blobState.blob!.arrayBuffer());
      if (!cancelled) setBytes(buf);
    })();
    return () => {
      cancelled = true;
    };
  }, [blobState.blob]);

  if (isLoading || !doc || !currentVersion) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (currentVersion.mime_type !== "application/pdf") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
        El editor solo soporta PDFs en V1. Convierte el documento primero.
      </div>
    );
  }

  if (!bytes) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-3 text-lg font-semibold">Editar — {doc.display_name}</h1>
      <DocumentEditor
        initialBytes={bytes}
        onCancel={() => navigate(`/${role}/documents/${doc.id}`)}
        onSave={async (out, notes) => {
          const file = new File([out], `${doc.display_name}.pdf`, {
            type: "application/pdf",
          });
          try {
            await addVersion.mutateAsync({ file, notes });
            toast.success("Versión guardada");
            navigate(`/${role}/documents/${doc.id}`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error guardando");
          }
        }}
      />
    </div>
  );
}
