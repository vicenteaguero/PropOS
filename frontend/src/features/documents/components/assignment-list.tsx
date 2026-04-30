import { Building2, User, Folder, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useContacts, useInternalAreas, useProperties } from "../hooks/use-entities";
import { useRemoveAssignment } from "../hooks/use-documents";
import type { Assignment } from "../types";

interface Props {
  documentId: string;
  assignments: Assignment[];
}

export function AssignmentList({ documentId, assignments }: Props) {
  const { data: properties } = useProperties();
  const { data: contacts } = useContacts();
  const { data: areas } = useInternalAreas();
  const remove = useRemoveAssignment(documentId);

  if (assignments.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        Sin vínculos. Conecta este documento a contactos, propiedades o áreas internas.
      </p>
    );
  }

  const labelFor = (a: Assignment): { label: string; icon: typeof Building2 } => {
    if (a.target_kind === "PROPERTY") {
      const p = properties?.find((x) => x.id === a.property_id);
      return { label: p?.title ?? a.property_id ?? "Propiedad", icon: Building2 };
    }
    if (a.target_kind === "CONTACT") {
      const c = contacts?.find((x) => x.id === a.contact_id);
      return { label: c?.full_name ?? a.contact_id ?? "Contacto", icon: User };
    }
    const ar = areas?.find((x) => x.id === a.internal_area_id);
    return { label: ar?.name ?? a.internal_area_id ?? "Área", icon: Folder };
  };

  return (
    <ul className="space-y-1.5">
      {assignments.map((a) => {
        const { label, icon: Icon } = labelFor(a);
        return (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
          >
            <Icon className="size-3.5 shrink-0 text-primary/70" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={async () => {
                try {
                  await remove.mutateAsync(a.id);
                  toast.success("Vínculo eliminado");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error");
                }
              }}
              aria-label="Eliminar vínculo"
            >
              <X className="size-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
