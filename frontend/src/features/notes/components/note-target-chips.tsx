import { Link } from "react-router-dom";
import { Building2, CalendarDays, FolderKanban, MapPin, TrendingUp, User, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { NoteTarget, NoteTargetKind } from "../api/notes-api";

export const KIND_LABEL: Record<NoteTargetKind, string> = {
  PROPERTY: "Propiedad",
  CONTACT: "Contacto",
  OPPORTUNITY: "Oportunidad",
  EVENT: "Evento",
  PROJECT: "Proyecto",
  PLACE: "Lugar",
};

const KIND_ICON: Record<NoteTargetKind, LucideIcon> = {
  PROPERTY: Building2,
  CONTACT: User,
  OPPORTUNITY: TrendingUp,
  EVENT: CalendarDays,
  PROJECT: FolderKanban,
  PLACE: MapPin,
};

/**
 * Where a chip navigates. Only properties and contacts have a detail page; the
 * rest fall back to the universal entity timeline, which takes any table name
 * (`/:role/timeline/:table/:id`) and is therefore never a dead end.
 */
export function targetPath(target: NoteTarget, role: string): string {
  switch (target.kind) {
    case "PROPERTY":
      // `/propiedades`, not `/properties`: the English path still resolves via
      // a legacy redirect, so this worked — it just took the long way round.
      return `/${role}/propiedades/${target.row_id}`;
    case "CONTACT":
      return `/${role}/personas/${target.row_id}`;
    case "OPPORTUNITY":
      // Deals have had their own page for a while; this was still sending them
      // to the raw timeline view.
      return `/${role}/negocios/${target.row_id}`;
    default:
      return `/${role}/timeline/${target.target_table}/${target.row_id}`;
  }
}

interface Props {
  targets: NoteTarget[];
  /** Omit to render read-only chips. */
  onRemove?: (target: NoteTarget) => void;
  className?: string;
}

/**
 * The linked records of a note, by name. This is the whole point of a note:
 * the list used to print the word "Contacto" and never which contact.
 */
export function NoteTargetChips({ targets, onRemove, className }: Props) {
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";
  if (targets.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {targets.map((target) => {
        const Icon = KIND_ICON[target.kind];
        return (
          <span
            key={`${target.kind}-${target.row_id}`}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-lg bg-secondary py-0.5 pl-1.5 text-[11px] font-semibold text-foreground",
              onRemove ? "pr-0.5" : "pr-2",
              // A record that no longer exists keeps its slot but reads as dead.
              !target.resolved && "text-muted-foreground line-through",
            )}
          >
            <Icon className="size-3 shrink-0 opacity-60" strokeWidth={2} />
            {target.resolved ? (
              <Link
                to={targetPath(target, role)}
                title={`${KIND_LABEL[target.kind]}: ${target.label}`}
                className="truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {target.label}
              </Link>
            ) : (
              <span className="truncate">{target.label}</span>
            )}
            {onRemove && (
              <button
                type="button"
                aria-label={`Desvincular ${target.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(target);
                }}
                className="flex size-4 shrink-0 items-center justify-center rounded-full text-faint hover:bg-background hover:text-destructive"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
