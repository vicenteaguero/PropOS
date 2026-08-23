import { Briefcase, Building2, CalendarDays, ChevronRight, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type EntityKind = "DEAL" | "PROPERTY" | "CONTACT" | "EVENT";

const ICONS: Record<EntityKind, LucideIcon> = {
  DEAL: Briefcase,
  PROPERTY: Building2,
  CONTACT: User,
  EVENT: CalendarDays,
};

const LABELS: Record<EntityKind, string> = {
  DEAL: "Negocio",
  PROPERTY: "Propiedad",
  CONTACT: "Persona",
  EVENT: "Evento",
};

interface EntityLinkRowProps {
  kind: EntityKind;
  /** The record's own name. Falls back to the kind when it has not resolved. */
  label?: string | null;
  /** Shown under the label — a stage, a role, an address. */
  sub?: string | null;
  onClick: () => void;
  className?: string;
}

/**
 * "This belongs to X", as a tappable row.
 *
 * Documents, the calendar's event dialog and the task sheet had each grown
 * their own copy of this — same icon set, same chevron, three slightly
 * different paddings — because the only shared thing was `NoteTargetChips`,
 * which is a chip strip for a note's targets and not a row.
 */
export function EntityLinkRow({ kind, label, sub, onClick, className }: EntityLinkRowProps) {
  const Icon = ICONS[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 text-left transition active:scale-[0.99] hover:bg-secondary/60",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {label || LABELS[kind]}
        </span>
        {sub && <span className="block truncate text-[12.5px] text-muted-foreground">{sub}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
    </button>
  );
}
