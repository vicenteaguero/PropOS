import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@shared/ui";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";
import { apiRequest } from "@shared/api/http";
import {
  AudienceCapsEditor,
  type AudienceCaps,
} from "@shared/components/audience-caps-editor/audience-caps-editor";

/** Who a record can be shared with. Same three roles for every entity so far. */
const AUDIENCES = ["owner", "agent", "buyer"];
const AUDIENCE_LABELS = { owner: "Propietario", agent: "Agente", buyer: "Comprador" };

interface SharePanelProps {
  /** Admin sharing endpoint for this entity, e.g. `/v1/admin/documents/abc`. */
  resourcePath: string;
  /** Query key to invalidate once permissions are saved. */
  invalidateKey: string;
  /** Capability ids this entity supports, in display order. */
  caps: string[];
  /** Spanish label per capability id. */
  capLabels: Record<string, string>;
  title: string;
  description: string;
  initialCaps?: AudienceCaps;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Audience-capability editor for any shareable record.
 *
 * Documents and interactions each carried their own copy of this — 171 lines
 * across the two, differing only in the capability list, one path segment, one
 * query key and two Spanish strings. The copies had already diverged in
 * presentation (both used a raw right-side `Sheet`, so neither got the bottom
 * sheet on a phone).
 */
export function SharePanel({
  resourcePath,
  invalidateKey,
  caps: capIds,
  capLabels,
  title,
  description,
  initialCaps,
  open,
  onOpenChange,
}: SharePanelProps) {
  const qc = useQueryClient();
  const [caps, setCaps] = useState<AudienceCaps>(initialCaps ?? {});

  useEffect(() => {
    if (open) setCaps(initialCaps ?? {});
  }, [open, initialCaps]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`${resourcePath}/sharing`, {
        method: "PATCH",
        body: { audience_caps: caps },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      toast.success("Permisos actualizados.");
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(`Error: ${e instanceof Error ? e.message : "desconocido"}`),
  });

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Share2 className="size-4" /> {title}
        </span>
      }
      description={description}
    >
      <div className="mt-4 space-y-4">
        <AudienceCapsEditor
          audiences={AUDIENCES}
          caps={capIds}
          value={caps}
          onChange={setCaps}
          capLabels={capLabels}
          audienceLabels={AUDIENCE_LABELS}
        />
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          {save.isPending ? <LoadingSpinner size="sm" /> : "Guardar"}
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
