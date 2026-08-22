import { Building2, ChevronRight, Folder, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@shared/hooks/use-auth";
import { useRemoveAssignment } from "../hooks/use-documents";
import type { Assignment } from "../types";

interface Props {
  documentId: string;
  assignments: Assignment[];
}

/**
 * What a document hangs off, as somewhere to go.
 *
 * Labels come from the assignment row now. They used to be resolved by
 * fetching `/v1/properties`, `/v1/contacts` and `/v1/internal-areas` on every
 * detail view and joining by id — three requests, and all three cap at 100
 * rows, so past that the fallback printed a raw UUID at the user.
 */
export function AssignmentList({ documentId, assignments }: Props) {
  const remove = useRemoveAssignment(documentId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  if (assignments.length === 0) {
    return (
      <p className="rounded-xl bg-secondary px-4 py-3 text-[13px] text-muted-foreground">
        Sin vínculos. Conecta este documento a contactos, propiedades o áreas internas.
      </p>
    );
  }

  const describe = (a: Assignment) => {
    if (a.target_kind === "PROPERTY") {
      return {
        label: a.label ?? "Propiedad",
        icon: Building2,
        href: a.property_id ? `/${role}/propiedades/${a.property_id}` : null,
      };
    }
    if (a.target_kind === "CONTACT") {
      return {
        label: a.label ?? "Contacto",
        icon: User,
        href: a.contact_id ? `/${role}/personas/${a.contact_id}` : null,
      };
    }
    return { label: a.label ?? "Área interna", icon: Folder, href: null };
  };

  return (
    <ul className="space-y-2">
      {assignments.map((a) => {
        const { label, icon: Icon, href } = describe(a);
        return (
          <li key={a.id} className="flex items-center gap-2 rounded-xl bg-card pr-1.5">
            <button
              type="button"
              disabled={!href}
              onClick={() => href && navigate(href)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition enabled:active:scale-[0.99] enabled:hover:bg-secondary/60"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                <Icon className="size-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{label}</span>
              {href && (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              )}
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 rounded-full text-muted-foreground"
              aria-label={`Quitar vínculo con ${label}`}
              onClick={() =>
                remove.mutate(a.id, {
                  onError: () => toast.error("No se pudo quitar el vínculo"),
                })
              }
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
