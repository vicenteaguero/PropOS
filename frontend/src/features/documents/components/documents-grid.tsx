import type { DocumentItem } from "../types";
import { DocumentCard } from "./document-card";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

export function DocumentsGrid({ documents, onOpen }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} onOpen={onOpen} />
      ))}
    </div>
  );
}
