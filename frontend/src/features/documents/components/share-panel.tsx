import { SharePanel } from "@shared/components/share-panel/share-panel";
import type { AudienceCaps } from "@shared/components/audience-caps-editor/audience-caps-editor";

const CAPS = ["view", "download"];
const CAP_LABELS = { view: "Ver", download: "Descargar" };

interface Props {
  documentId: string;
  initialCaps?: AudienceCaps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSharePanel({ documentId, initialCaps, open, onOpenChange }: Props) {
  return (
    <SharePanel
      resourcePath={`/v1/admin/documents/${documentId}`}
      invalidateKey="documents"
      caps={CAPS}
      capLabels={CAP_LABELS}
      title="Compartir documento"
      description="Marcá qué audiencia puede ver/descargar este documento. Sin marcar = nadie fuera del admin."
      initialCaps={initialCaps}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
