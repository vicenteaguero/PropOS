import { SharePanel } from "@shared/components/share-panel/share-panel";
import type { AudienceCaps } from "@shared/components/audience-caps-editor/audience-caps-editor";

const CAPS = ["view", "view_visitor_identity", "view_visit_documents"];
const CAP_LABELS = {
  view: "Ver visita",
  view_visitor_identity: "Ver quién",
  view_visit_documents: "Ver docs adjuntos",
};

interface Props {
  interactionId: string;
  initialCaps?: AudienceCaps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InteractionSharePanel({ interactionId, initialCaps, open, onOpenChange }: Props) {
  return (
    <SharePanel
      resourcePath={`/v1/admin/interactions/${interactionId}`}
      invalidateKey="interactions"
      caps={CAPS}
      capLabels={CAP_LABELS}
      title="Compartir visita"
      description="Definí qué audiencia ve la visita y con qué nivel de detalle."
      initialCaps={initialCaps}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
