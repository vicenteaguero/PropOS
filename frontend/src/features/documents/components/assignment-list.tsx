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
      <p className="rounded-xl bg-secondary px-4 py-3 text-[13px] text-muted-foreground">
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
    <ul className="space-y-2">
      {assignments.map((a) => {
        const { label, icon: Icon } = labelFor(a);
        return (
          <li
            key={a.id}
            className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-sm"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
              <Icon className="size-4" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-full text-muted-foreground"
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
              <X className="size-3.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
