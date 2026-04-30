import type { DocumentItem } from "../types";
import { DocumentCard } from "./document-card";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

export function DocumentsGrid({ documents, onOpen }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} onOpen={onOpen} />
      ))}
    </div>
  );
}
