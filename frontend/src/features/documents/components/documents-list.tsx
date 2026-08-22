import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { DocumentItem } from "../types";
import { DOCUMENT_ROW_HEIGHT, DocumentRow } from "./document-row";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

export function DocumentsList({ documents, onOpen }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    // Fixed rather than measured: every row is the same shape, and variable
    // sizing in react-virtual costs scroll-position stability on a phone for
    // nothing in return.
    estimateSize: () => DOCUMENT_ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="h-[calc(100dvh-220px)] overflow-auto rounded-xl border border-border bg-card"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vrow) => {
          const doc = documents[vrow.index];
          if (!doc) return null;
          return (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onOpen={onOpen}
              absolute
              style={{ top: vrow.start, height: vrow.size }}
            />
          );
        })}
      </div>
    </div>
  );
}
