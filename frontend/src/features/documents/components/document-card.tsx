import { WifiOff } from "lucide-react";
import { PriorityToggle } from "./priority-toggle";
import { cn } from "@/lib/utils";
import { DocumentKindPill } from "./document-kind-pill";
import { DocumentThumb } from "./document-thumb";
import { primaryAssignmentLabel } from "../lib/assignment-label";
import type { DocumentItem } from "../types";

interface Props {
  doc: DocumentItem;
  onOpen: (doc: DocumentItem) => void;
}

export function DocumentCard({ doc, onOpen }: Props) {
  const where = primaryAssignmentLabel(doc);
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl",
        // A priority document is marked by its whole card, not by one more badge
        // in a corner full of badges.
        doc.is_priority ? "bg-warning/10 ring-1 ring-warning/40" : "bg-card",
      )}
    >
      {/* Outside the card button: nested interactive elements are invalid. */}
      <PriorityToggle
        doc={doc}
        className="absolute left-1 top-1 z-10 size-7 rounded-full bg-black/35 backdrop-blur-sm"
      />
      <button
        type="button"
        onClick={() => onOpen(doc)}
        className="flex flex-col text-left transition active:scale-[0.98]"
      >
        <div className="relative">
          <DocumentThumb doc={doc} variant="tile" />
          {doc.pin_offline && (
            <span
              className="absolute right-1.5 top-1.5 inline-flex items-center rounded-full bg-primary p-1 text-primary-foreground"
              title="Disponible sin conexión"
            >
              <WifiOff className="size-2.5" strokeWidth={2} />
            </span>
          )}
        </div>
        {/* Three per row on a phone leaves ~110px of width, so the footer carries
          the name, where it belongs, and the kind — and nothing else. The
          version number and the link count were noise at any width: neither is
          why anyone is scanning a wall of documents. */}
        <div className="space-y-1 p-2">
          <div className="line-clamp-2 text-[12px] font-semibold leading-tight text-foreground">
            {doc.display_name}
          </div>
          <div className="flex items-center gap-1">
            <DocumentKindPill doc={doc} />
          </div>
          {where && (
            <div className="truncate text-[11px] leading-tight text-muted-foreground">{where}</div>
          )}
        </div>
      </button>
    </div>
  );
}
