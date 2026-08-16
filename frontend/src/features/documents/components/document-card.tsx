import { useState } from "react";
import { FileText, FileImage, FileType2, FileQuestion, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@shared/lib/format";
import { DocumentKindPill } from "./document-kind-pill";
import type { DocumentItem } from "../types";

interface Props {
  doc: DocumentItem;
  onOpen: (doc: DocumentItem) => void;
}

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

export function DocumentCard({ doc, onOpen }: Props) {
  const Icon = iconFor(doc.kind);
  const v = doc.current_version;
  const thumbUrl = v?.thumbnail_url ?? null;
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = Boolean(thumbUrl) && !thumbFailed;

  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-card text-left transition active:scale-[0.98]"
    >
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-secondary">
        {showThumb ? (
          <>
            {!thumbLoaded && <Skeleton className="absolute inset-0 h-full w-full" />}
            <img
              src={thumbUrl ?? undefined}
              alt={doc.display_name}
              loading="lazy"
              decoding="async"
              onLoad={() => setThumbLoaded(true)}
              onError={() => setThumbFailed(true)}
              className={`h-full w-full object-cover transition-opacity ${
                thumbLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <Icon className="size-12 text-muted-foreground" strokeWidth={1.4} />
        )}
        {v?.size_bytes ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {formatBytes(v.size_bytes)}
          </span>
        ) : null}
        {doc.pin_offline && (
          <span
            className="absolute right-2 top-2 inline-flex items-center rounded-full bg-primary p-1.5 text-primary-foreground"
            title="Disponible sin conexión"
          >
            <WifiOff className="size-3" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="line-clamp-2 text-[15px] font-semibold leading-tight text-foreground">
          {doc.display_name}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DocumentKindPill doc={doc} />
          {v && <span className="text-xs text-muted-foreground">v{v.version_number}</span>}
          {doc.assignments && doc.assignments.length > 0 && (
            <span className="text-xs text-muted-foreground">· {doc.assignments.length} vínc.</span>
          )}
        </div>
      </div>
    </button>
  );
}
