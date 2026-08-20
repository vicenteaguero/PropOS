import { useMemo } from "react";
import { FilterSelect } from "./filter-select";

export interface FilterableProperty {
  id: string;
  title: string | null;
  address?: string | null;
  status?: string | null;
  is_draft?: boolean | null;
  updated_at?: string | null;
}

/**
 * Properties in the order a broker thinks about them.
 *
 * Alphabetical is the wrong answer: the portfolio runs to dozens of records and
 * the ones being worked are always the published, available ones. So: live
 * listings first, then anything still active but unpublished, then the rest —
 * and inside each band the most recently touched wins, because a property
 * edited this morning is almost certainly the one being looked for.
 */
export function rankProperties<T extends FilterableProperty>(properties: T[]): T[] {
  const band = (p: T) => {
    const status = (p.status ?? "").toUpperCase();
    if (!p.is_draft && status === "AVAILABLE") return 0;
    if (status === "AVAILABLE" || status === "RESERVED") return 1;
    return 2;
  };
  return [...properties].sort((a, b) => {
    const d = band(a) - band(b);
    if (d !== 0) return d;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
}

interface Props {
  properties: FilterableProperty[];
  value: string | null;
  onChange: (propertyId: string | null) => void;
  label?: string;
  className?: string;
}

/**
 * "Show me everything about this property" — the filter every CRM surface
 * needs and none of them had. Reused by people, deals and documents so the
 * ordering rule lives in one place.
 */
export function PropertyFilter({
  properties,
  value,
  onChange,
  label = "Propiedad",
  className,
}: Props) {
  const options = useMemo(
    () =>
      rankProperties(properties).map((p) => ({
        value: p.id,
        label: p.title ?? "Sin título",
        sub: p.address ?? undefined,
      })),
    [properties],
  );

  return (
    <FilterSelect
      label={label}
      value={value}
      onChange={onChange}
      allLabel="Todas las propiedades"
      options={options}
      className={className}
    />
  );
}
