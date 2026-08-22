import { ArrowUpDown } from "lucide-react";
import { FilterSelect } from "@shared/ui";
import { SORT_OPTIONS, type SortMode } from "../lib/document-sort";

/**
 * Reordering, which is not the same control as grouping and never was.
 *
 * "Agrupar" answers "what buckets", this answers "in what order" — they
 * compose, so both are on the bar and the list applies the order inside each
 * group. Built on `FilterSelect` so it opens as a menu under a cursor and as a
 * bottom sheet under a thumb, like every other one-choice control here.
 */
export function SortControl({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  return (
    <FilterSelect
      label="Ordenar"
      value={value}
      options={SORT_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        sub: o.sub,
        icon: <ArrowUpDown className="size-4 shrink-0" strokeWidth={1.9} />,
      }))}
      onChange={(next) => onChange((next as SortMode) ?? "recent")}
    />
  );
}
