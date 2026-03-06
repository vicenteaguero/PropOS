import { useState } from "react";
import { FileText, Image, File } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { DocumentViewer } from "@shared/components/document-viewer/document-viewer";
import { useDocuments } from "@features/documents/hooks/use-documents";
import type { Document } from "@features/documents/types";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function getFileIcon(filename: string) {
  const ext = getExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return Image;
  if (ext === "pdf") return FileText;
  return File;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentsPage() {
  const { data: documents, isLoading, error } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-destructive">Error al cargar documentos: {error.message}</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <File className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="mb-1 text-lg font-semibold text-foreground">Sin documentos</h3>
        <p className="text-sm text-muted-foreground">No hay documentos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold text-foreground">Documentos</h2>
      <div className="space-y-2">
        {documents.map((doc) => {
          const Icon = getFileIcon(doc.filename);
          return (
            <Card
              key={doc.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => setSelectedDoc(doc)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedDoc && (
        <DocumentViewer
          url={selectedDoc.storagePath}
          filename={selectedDoc.filename}
          type={selectedDoc.entityType}
          open={!!selectedDoc}
          onOpenChange={(open) => {
            if (!open) setSelectedDoc(null);
          }}
        />
      )}
    </div>
  );
}
