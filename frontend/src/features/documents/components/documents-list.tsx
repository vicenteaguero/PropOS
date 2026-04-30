import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { FileText } from "lucide-react";
import type { DocumentItem } from "../types";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

const ROW_HEIGHT = 56;

export function DocumentsList({ documents, onOpen }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="h-[calc(100dvh-220px)] overflow-auto rounded-md border border-border bg-card"
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
      >
        {virtualizer.getVirtualItems().map((vrow) => {
          const doc = documents[vrow.index];
          return (
            <button
              type="button"
              key={doc.id}
              onClick={() => onOpen(doc)}
              className="absolute left-0 right-0 flex items-center gap-3 border-b border-border px-4 text-left text-sm hover:bg-accent"
              style={{ top: vrow.start, height: vrow.size }}
            >
              <FileText className="size-5 shrink-0 text-primary/70" strokeWidth={1.4} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{doc.display_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {doc.kind} · v{doc.current_version?.version_number ?? "?"} ·{" "}
                  {doc.assignments?.length ?? 0} vínculos
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {new Date(doc.updated_at).toLocaleDateString()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
