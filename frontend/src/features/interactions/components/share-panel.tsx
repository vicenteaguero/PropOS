import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";
import { apiRequest } from "@features/documents/api/http";
import {
  AudienceCapsEditor,
  type AudienceCaps,
} from "@shared/components/audience-caps-editor/audience-caps-editor";

const AUDIENCES = ["owner", "agent", "buyer"];
const CAPS = ["view", "view_visitor_identity", "view_visit_documents"];
const CAP_LABELS = {
  view: "Ver visita",
  view_visitor_identity: "Ver quién",
  view_visit_documents: "Ver docs adjuntos",
};
const AUDIENCE_LABELS = { owner: "Propietario", agent: "Agente", buyer: "Comprador" };

interface Props {
  interactionId: string;
  initialCaps?: AudienceCaps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InteractionSharePanel({ interactionId, initialCaps, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [caps, setCaps] = useState<AudienceCaps>(initialCaps ?? {});

  useEffect(() => {
    if (open) setCaps(initialCaps ?? {});
  }, [open, initialCaps]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/admin/interactions/${interactionId}/sharing`, {
        method: "PATCH",
        body: { audience_caps: caps },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions"] });
      toast.success("Permisos actualizados.");
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Share2 className="size-4" /> Compartir visita
          </SheetTitle>
          <SheetDescription>
            Definí qué audiencia ve la visita y con qué nivel de detalle.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <AudienceCapsEditor
            audiences={AUDIENCES}
            caps={CAPS}
            value={caps}
            onChange={setCaps}
            capLabels={CAP_LABELS}
            audienceLabels={AUDIENCE_LABELS}
          />
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? <LoadingSpinner size="sm" /> : "Guardar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
