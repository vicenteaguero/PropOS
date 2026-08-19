import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { FileText, FileType2, FileImage, FileQuestion, WifiOff } from "lucide-react";
import { formatBytes } from "@shared/lib/format";
import type { DocumentItem } from "../types";
import { DocumentKindPill } from "./document-kind-pill";
import { formatDate } from "@shared/utils/format";

interface Props {
  documents: DocumentItem[];
  onOpen: (doc: DocumentItem) => void;
}

const ROW_HEIGHT = 72;

function iconFor(kind: DocumentItem["kind"]) {
  switch (kind) {
    case "PDF":
      return FileText;
    case "DOCX":
      return FileType2;
    case "IMAGE_PDF":
      return FileImage;
    default:
      return FileQuestion;
  }
}

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
      className="h-[calc(100dvh-220px)] overflow-auto rounded-2xl border border-border bg-card"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((vrow) => {
          const doc = documents[vrow.index];
          if (!doc) return null;
          const Icon = iconFor(doc.kind);
          const v = doc.current_version;
          const sub = [
            v ? `v${v.version_number}` : null,
            formatBytes(v?.size_bytes),
            `${doc.assignments?.length ?? 0} vínculos`,
            formatDate(doc.updated_at),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              type="button"
              key={doc.id}
              onClick={() => onOpen(doc)}
              className="absolute left-0 right-0 flex items-center gap-3 border-b border-border px-4 text-left transition last:border-b-0 hover:bg-secondary/50 active:scale-[0.99]"
              style={{ top: vrow.start, height: vrow.size }}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight text-foreground">
                  {doc.pin_offline && <WifiOff className="size-3.5 shrink-0 text-primary" />}
                  <span className="truncate">{doc.display_name}</span>
                </div>
                <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{sub}</div>
              </div>
              <DocumentKindPill doc={doc} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
