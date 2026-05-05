import { useState } from "react";
import { FileText, FileImage, FileType2, FileQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    <Card
      className="group cursor-pointer p-3 transition-colors hover:bg-accent"
      onClick={() => onOpen(doc)}
    >
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-muted/50">
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
          <Icon className="size-12 text-primary/70" strokeWidth={1.2} />
        )}
      </div>
      <div className="mt-3 space-y-1">
        <div className="line-clamp-2 text-sm font-medium leading-tight">{doc.display_name}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {doc.kind}
          </Badge>
          {v && (
            <Badge variant="outline" className="text-[10px]">
              v{v.version_number}
            </Badge>
          )}
          {doc.assignments && doc.assignments.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {doc.assignments.length} vínc.
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
