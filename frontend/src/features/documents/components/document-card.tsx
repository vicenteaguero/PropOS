import { FileText, FileImage, FileType2, FileQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  return (
    <Card
      className="group cursor-pointer p-3 transition-colors hover:bg-accent"
      onClick={() => onOpen(doc)}
    >
      <div className="flex aspect-[3/4] items-center justify-center rounded-md bg-muted/50">
        <Icon className="size-12 text-primary/70" strokeWidth={1.2} />
      </div>
      <div className="mt-3 space-y-1">
        <div className="line-clamp-2 text-sm font-medium leading-tight">
          {doc.display_name}
        </div>
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
