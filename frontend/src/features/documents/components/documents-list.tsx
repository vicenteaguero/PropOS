import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentItem } from "../types";
import { DocumentKindPill } from "./document-kind-pill";
import { DocumentThumb } from "./document-thumb";
import { primaryAssignmentLabel } from "../lib/assignment-label";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

// 64px thumbnail + py-3 top and bottom. Fixed rather than measured: every row
// is the same shape, and variable sizing in react-virtual costs scroll-position
// stability on a phone for nothing in return.
const ROW_HEIGHT = 88;

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
      className="h-[calc(100dvh-220px)] overflow-auto rounded-xl border border-border bg-card"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vrow) => {
          const doc = documents[vrow.index];
          if (!doc) return null;
          // Where it belongs, not what it weighs. The version number, the link
          // count and the modified date were three facts nobody scans a list
          // for; which property a document hangs off is the one they do.
          const where = primaryAssignmentLabel(doc);
          return (
            <button
              type="button"
              key={doc.id}
              onClick={() => onOpen(doc)}
              className={cn(
                "absolute left-0 right-0 flex items-center gap-3 border-b border-border px-4 text-left transition last:border-b-0 hover:bg-secondary/50",
                doc.is_priority && "bg-warning/10",
              )}
              style={{ top: vrow.start, height: vrow.size }}
            >
              <DocumentThumb doc={doc} variant="rail" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight text-foreground">
                  {doc.pin_offline && <WifiOff className="size-3.5 shrink-0 text-primary" />}
                  <span className="truncate">{doc.display_name}</span>
                </div>
                {where && (
                  <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{where}</div>
                )}
              </div>
              <DocumentKindPill doc={doc} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
