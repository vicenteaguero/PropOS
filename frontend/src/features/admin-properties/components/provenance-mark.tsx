import { BadgeCheck, CircleHelp, Sparkles, UserRound } from "lucide-react";
import type { Provenance } from "../api/properties-api";

/**
 * How sure we are about one number.
 *
 * A property page where every field looks equally true produces an assistant
 * that states an owner's guess as a measurement — and a buyer who signs on it.
 * Separating the three cases is what lets Propo say "el propietario declara
 * 120 m², sin certificar" instead of just "120 m²".
 *
 * Deliberately small and monochrome except for `verified`: the mark qualifies
 * the number, it does not compete with it.
 */
const MARK = {
  verified: {
    Icon: BadgeCheck,
    className: "text-success",
    title: "Verificado con documento",
  },
  declared: {
    Icon: UserRound,
    className: "text-muted-foreground",
    title: "Declarado por el propietario, sin certificar",
  },
  derived: {
    Icon: Sparkles,
    className: "text-muted-foreground",
    title: "Estimado por Propo",
  },
  unknown: {
    Icon: CircleHelp,
    className: "text-faint",
    title: "Origen no registrado",
  },
} as const;

export function ProvenanceMark({ source }: { source: Provenance }) {
  const { Icon, className, title } = MARK[source];
  return (
    <Icon
      className={`size-3.5 shrink-0 ${className}`}
      strokeWidth={2}
      aria-label={title}
      role="img"
    />
  );
}

export const PROVENANCE_TITLE: Record<Provenance, string> = {
  verified: MARK.verified.title,
  declared: MARK.declared.title,
  derived: MARK.derived.title,
  unknown: MARK.unknown.title,
};
