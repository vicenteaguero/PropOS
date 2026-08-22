import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentKindPill } from "./document-kind-pill";
import { DocumentThumb } from "./document-thumb";
import { primaryAssignmentLabel } from "../lib/assignment-label";
import type { DocumentItem } from "../types";

/** 64px thumbnail + py-3 top and bottom. */
export const DOCUMENT_ROW_HEIGHT = 88;

/**
 * One document as a row. Shared by the virtualized flat list and the grouped
 * list, which is why it does not own its own positioning.
 */
export function DocumentRow({
  doc,
  onOpen,
  style,
  absolute,
}: {
  doc: DocumentItem;
  onOpen: (doc: DocumentItem) => void;
  style?: React.CSSProperties;
  absolute?: boolean;
}) {
  // Where it belongs, not what it weighs. The version number, the link count
  // and the modified date were three facts nobody scans a list for.
  const where = primaryAssignmentLabel(doc);
  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      style={style}
      className={cn(
        "flex items-center gap-3 border-b border-border px-4 text-left transition last:border-b-0 hover:bg-secondary/50",
        absolute ? "absolute left-0 right-0" : "w-full",
        doc.is_priority && "bg-warning/10",
      )}
    >
      <DocumentThumb doc={doc} variant="rail" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[15px] font-semibold leading-tight text-foreground">
          {doc.pin_offline && <WifiOff className="size-3.5 shrink-0 text-primary" />}
          <span className="truncate">{doc.display_name}</span>
        </div>
        {where && <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{where}</div>}
      </div>
      <DocumentKindPill doc={doc} />
    </button>
  );
}
