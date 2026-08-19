import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageLayout } from "@shared/components/page-layout";
import { ErrorState, PageSkeleton } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import { useAddVersion, useDocument } from "../hooks/use-documents";
import { useDocumentBlob } from "../hooks/use-document-blob";
import { DocumentEditor } from "../components/document-editor";
import type { DocumentVersion } from "../types";
import { usePageTitle } from "@app/page-meta";

/**
 * Downloads the version bytes and mounts the editor. Split out so a failed
 * download can be retried by remounting this component (via `key`) instead of
 * leaving the page on a spinner that never resolves.
 */
function EditorLoader({
  documentId,
  version,
  onRetry,
  onCancel,
  onSave,
}: {
  documentId: string;
  version: DocumentVersion;
  onRetry: () => void;
  onCancel: () => void;
  onSave: (bytes: Uint8Array, notes: string | undefined) => Promise<void>;
}) {
  const blobState = useDocumentBlob(documentId, version);
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

  if (blobState.error) {
    return (
      <ErrorState
        message="No se pudo descargar el documento."
        error={blobState.error}
        onRetry={onRetry}
      />
    );
  }

  if (!bytes) {
    return <PageSkeleton variant="detail" />;
  }

  return <DocumentEditor initialBytes={bytes} onCancel={onCancel} onSave={onSave} />;
}

export function DocumentEditorPage() {
  usePageTitle("Editar documento");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const { data: doc, isLoading, error, refetch } = useDocument(id);
  const currentVersion = doc?.current_version ?? doc?.versions?.[0] ?? null;
  const addVersion = useAddVersion(id ?? "");

  // Bumped to remount `EditorLoader` and re-run the download after a failure.
  const [attempt, setAttempt] = useState(0);

  if (isLoading) {
    return (
      <PageLayout width="xl">
        <PageSkeleton variant="detail" />
      </PageLayout>
    );
  }

  // A deleted document, a wrong id or a 403 lands here with no data.
  if (!doc) {
    return (
      <PageLayout width="md" className="lg:max-w-6xl">
        <ErrorState
          message="No se pudo cargar el documento."
          error={error}
          onRetry={() => refetch()}
        />
      </PageLayout>
    );
  }

  if (!currentVersion) {
    return (
      <PageLayout width="md" className="lg:max-w-6xl">
        <p className="text-sm text-muted-foreground">
          Este documento todavía no tiene versiones para editar.
        </p>
      </PageLayout>
    );
  }

  if (currentVersion.mime_type !== "application/pdf") {
    return (
      <PageLayout width="md" className="lg:max-w-6xl">
        <p className="text-sm text-muted-foreground">
          El editor solo soporta PDFs en V1. Convierte el documento primero.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="xl">
      <h1 className="mb-3 text-lg font-semibold">Editar — {doc.display_name}</h1>
      <EditorLoader
        key={attempt}
        documentId={doc.id}
        version={currentVersion}
        onRetry={() => setAttempt((a) => a + 1)}
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
    </PageLayout>
  );
}

// Default export so the router can code-split this page with React.lazy.
export default DocumentEditorPage;
