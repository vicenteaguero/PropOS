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
const CAPS = ["view", "download"];
const CAP_LABELS = { view: "Ver", download: "Descargar" };
const AUDIENCE_LABELS = { owner: "Propietario", agent: "Agente", buyer: "Comprador" };

interface Props {
  documentId: string;
  initialCaps?: AudienceCaps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSharePanel({ documentId, initialCaps, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [caps, setCaps] = useState<AudienceCaps>(initialCaps ?? {});

  useEffect(() => {
    if (open) setCaps(initialCaps ?? {});
  }, [open, initialCaps]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/admin/documents/${documentId}/sharing`, {
        method: "PATCH",
        body: { audience_caps: caps },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
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
            <Share2 className="size-4" /> Compartir documento
          </SheetTitle>
          <SheetDescription>
            Marcá qué audiencia puede ver/descargar este documento. Sin marcar = nadie fuera del
            admin.
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
