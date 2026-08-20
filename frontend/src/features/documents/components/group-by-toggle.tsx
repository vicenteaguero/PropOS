import { FilterSelect } from "@shared/ui";

export type GroupByMode = "all" | "property" | "contact";

interface Props {
  value: GroupByMode;
  onChange: (mode: GroupByMode) => void;
}

/**
 * Grouping is one choice out of three, which is a select — not three chips.
 *
 * As chips it needed a whole row, and inside the 17rem document rail the third
 * option was clipped off the edge with no way to reach it.
 */
export function GroupByToggle({ value, onChange }: Props) {
  return (
    <FilterSelect
      label="Agrupar"
      value={value === "all" ? null : value}
      onChange={(v) => onChange((v ?? "all") as GroupByMode)}
      allLabel="Sin agrupar"
      options={[
        { value: "property", label: "Por propiedad" },
        { value: "contact", label: "Por contacto" },
      ]}
    />
  );
}
