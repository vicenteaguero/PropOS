import { useEffect, useState } from "react";
import { documentsApi } from "../api/documents-api";
import { readDocument, type CachedRead } from "../services/cache/cache-manager";
import type { DocumentVersion } from "../types";

export interface DocumentBlobState {
  loading: boolean;
  error: string | null;
  blob: Blob | null;
  source: "cache" | "network" | null;
  integrityOk: boolean;
}

export function useDocumentBlob(
  documentId: string | undefined,
  version: DocumentVersion | null | undefined,
): DocumentBlobState {
  const [state, setState] = useState<DocumentBlobState>({
    loading: false,
    error: null,
    blob: null,
    source: null,
    integrityOk: true,
  });

  useEffect(() => {
    if (!documentId || !version) {
      setState({ loading: false, error: null, blob: null, source: null, integrityOk: true });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const attempt = async (retries: number): Promise<void> => {
      try {
        const { url } = await documentsApi.versionDownloadUrl(documentId, version.id);
        const result: CachedRead = await readDocument({
          documentId,
          versionId: version.id,
          sha256: version.sha256,
          mimeType: version.mime_type,
          signedUrl: url,
        });
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          blob: result.blob,
          source: result.source,
          integrityOk: result.integrityOk,
        });
      } catch (e) {
        if (cancelled) return;
        // Storage may take a moment to make a freshly-uploaded object readable
        // through a signed URL. Retry a couple of times before surfacing the
        // error so the user doesn't see a phantom "No se pudo cargar" right
        // after creating a document.
        if (retries > 0) {
          setTimeout(() => {
            if (!cancelled) void attempt(retries - 1);
          }, 2000);
          return;
        }
        setState({
          loading: false,
          error: e instanceof Error ? e.message : "Error",
          blob: null,
          source: null,
          integrityOk: true,
        });
      }
    };
    void attempt(3);
    return () => {
      cancelled = true;
    };
  }, [documentId, version?.id, version?.sha256]);

  return state;
}
